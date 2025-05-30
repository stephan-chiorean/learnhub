#!/usr/bin/env python3

import os
import json
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Union
from dataclasses import dataclass, asdict
from enum import Enum
import re
import sys
import time
import hashlib

from code_splitter import TiktokenSplitter, Language
from tree_sitter_languages import get_parser
import tree_sitter_languages

# Get the script's directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Path to the combined tree-sitter library
MY_LANG_LIB = os.path.join(SCRIPT_DIR, 'tree-sitter', 'build', 'my-languages.so')

# Constants for code-splitter based languages
CODE_SPLITTER_EXTENSIONS = {
    '.py': Language.Python,
    '.go': Language.Golang,
    '.rs': Language.Rust,
    '.md': Language.Markdown,
}

# Constants for tree-sitter based languages
TREE_SITTER_EXTENSIONS = {
    '.ts': 'typescript',
    '.js': 'typescript',
    '.tsx': 'tsx',
    '.jsx': 'tsx',
    '.java': 'java',
    '.cjs': 'typescript',  # Add CommonJS files
    '.baml': 'typescript',  # Add BAML files
}

# Dynamically load tree-sitter languages
TREE_SITTER_LANGUAGES = {}
TREE_SITTER_PARSERS = {}  # Cache for parsers

try:
    # Register each language using tree_sitter_languages
    for lang_name in ['typescript', 'tsx', 'java']:
        parser = get_parser(lang_name)
        if parser:
            TREE_SITTER_PARSERS[lang_name] = parser
except Exception as e:
    pass

# Constants for non-code files
NON_CODE_EXTENSIONS = {
    'Dockerfile': 'dockerfile',
    '.yaml': 'config',
    '.yml': 'config',
    '.toml': 'config',
    '.env': 'config',
}

@dataclass
class Chunk:
    id: str
    chunk_hash: str
    relative_path: str
    start_line: int
    end_line: int
    content: str

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'chunk_hash': self.chunk_hash,
            'relative_path': self.relative_path,
            'start_line': self.start_line,
            'end_line': self.end_line,
            'content': self.content
        }

@dataclass
class CodeChunk(Chunk):
    size: int
    is_test_file: Optional[bool] = None
    function_name: Optional[str] = None
    language: Optional[str] = None
    zone_guess: str = ""

    def __post_init__(self):
        if not isinstance(self.start_line, int) or self.start_line <= 0:
            raise ValueError("start_line must be a positive integer")
        if not isinstance(self.end_line, int) or self.end_line < self.start_line:
            raise ValueError("end_line must be >= start_line")
        if not isinstance(self.size, int) or self.size <= 0:
            raise ValueError("size must be a positive integer")

def is_test_file(file_path: str) -> bool:
    """Determine if a file is a test file based on common patterns."""
    test_patterns = [
        r'test_.*\.py$',
        r'.*_test\.py$',
        r'.*\.test\.(js|ts|tsx)$',
        r'.*\.spec\.(js|ts|tsx)$',
        r'.*Test\.(java|kt)$',
        r'.*_test\.(go|rs)$',
    ]
    return any(re.search(pattern, file_path) for pattern in test_patterns)

def get_relative_path(file_path: str, base_dir: str) -> str:
    """Get the relative path from base_dir to file_path."""
    return os.path.relpath(file_path, base_dir)

def generate_chunk_hash(content: str) -> str:
    """Generate a hash of the chunk content."""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def chunk_with_tree_sitter(content: str, language: str, file_path: str, base_dir: str) -> List[Chunk]:
    """Chunk a file using tree-sitter AST parsing."""
    if language not in TREE_SITTER_PARSERS:
        return []

    parser = TREE_SITTER_PARSERS[language]
    try:
        source_bytes = content.encode('utf-8')
        tree = parser.parse(source_bytes)
    except Exception:
        return []
    
    chunks = []
    relative_path = get_relative_path(file_path, base_dir)
    
    if language in ['typescript', 'tsx']:
        node_types = [
            'function_declaration',
            'method_definition',
            'class_declaration',
            'interface_declaration',
            'type_alias_declaration',
            'enum_declaration',
            'variable_declaration',
            'export_statement',
            'import_statement',
            'jsx_element',
            'jsx_self_closing_element'
        ]
    elif language == 'java':
        node_types = ['method_declaration', 'class_declaration']
    else:
        return []

    def process_node(node):
        if node.type in node_types:
            start_line = node.start_point[0] + 1
            end_line = node.end_point[0] + 1
            try:
                node_text = source_bytes[node.start_byte:node.end_byte].decode('utf-8')
            except UnicodeDecodeError:
                return
            
            function_name = None
            if node.type in ['function_declaration', 'method_definition', 'method_declaration']:
                name_node = node.child_by_field_name('name')
                if name_node:
                    try:
                        function_name = name_node.text.decode('utf-8')
                    except UnicodeDecodeError:
                        function_name = None
            elif node.type in ['class_declaration', 'interface_declaration', 'type_alias_declaration', 'enum_declaration']:
                name_node = node.child_by_field_name('name')
                if name_node:
                    try:
                        function_name = name_node.text.decode('utf-8')
                    except UnicodeDecodeError:
                        function_name = None
            
            chunks.append(CodeChunk(
                id=str(uuid.uuid4()),
                chunk_hash=generate_chunk_hash(node_text),
                relative_path=relative_path,
                start_line=start_line,
                end_line=end_line,
                size=len(node_text),
                is_test_file=is_test_file(file_path),
                function_name=function_name,
                language=language,
                content=node_text
            ))
        
        for child in node.children:
            process_node(child)

    process_node(tree.root_node)
    
    if not chunks:
        chunks.append(CodeChunk(
            id=str(uuid.uuid4()),
            chunk_hash=generate_chunk_hash(content),
            relative_path=relative_path,
            start_line=1,
            end_line=len(content.splitlines()),
            size=len(content),
            is_test_file=is_test_file(file_path),
            language=language,
            content=content
        ))
    
    return chunks

def chunk_code_file(file_path: str, base_dir: str) -> List[Chunk]:
    """Chunk a code file using either code-splitter or tree-sitter."""
    extension = os.path.splitext(file_path)[1].lower()
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return []

    if extension in CODE_SPLITTER_EXTENSIONS:
        language = CODE_SPLITTER_EXTENSIONS[extension]
        splitter = TiktokenSplitter(language=language, max_size=8192)
        chunks = []
        
        for chunk in splitter.split(content):
            relative_path = get_relative_path(file_path, base_dir)
            chunk_content = chunk.text
            chunks.append(Chunk(
                id=str(uuid.uuid4()),
                chunk_hash=generate_chunk_hash(chunk_content),
                relative_path=relative_path,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
                content=chunk_content
            ))
        return chunks
    
    elif extension in TREE_SITTER_EXTENSIONS:
        language = TREE_SITTER_EXTENSIONS[extension]
        return chunk_with_tree_sitter(content, language, file_path, base_dir)
    
    elif extension in ['.baml', '.cjs'] or file_path.endswith('.baml'):
        relative_path = get_relative_path(file_path, base_dir)
        return [Chunk(
            id=str(uuid.uuid4()),
            chunk_hash=generate_chunk_hash(content),
            relative_path=relative_path,
            start_line=1,
            end_line=len(content.splitlines()),
            content=content
        )]
    
    return []

def chunk_markdown(content: str, file_path: str, base_dir: str) -> List[Chunk]:
    """Split markdown files by headings."""
    sections = re.split(r'^#{2,3}\s+', content, flags=re.MULTILINE)
    chunks = []
    
    for i, section in enumerate(sections):
        if not section.strip():
            continue

        start_line = content[:content.find(section)].count('\n') + 1
        end_line = start_line + section.count('\n')

        relative_path = get_relative_path(file_path, base_dir)
        section_content = section.strip()
        chunks.append(Chunk(
            id=str(uuid.uuid4()),
            chunk_hash=generate_chunk_hash(section_content),
            relative_path=relative_path,
            start_line=start_line,
            end_line=end_line,
            content=section_content
        ))

    return chunks

def chunk_dockerfile(content: str, file_path: str, base_dir: str) -> List[Chunk]:
    """Split Dockerfile by commands."""
    commands = re.split(r'\n(?=RUN |ARG |ENV |COPY |ENTRYPOINT |CMD |FROM |WORKDIR )', content)
    chunks = []

    for i, command in enumerate(commands):
        if not command.strip():
            continue

        start_line = content[:content.find(command)].count('\n') + 1
        end_line = start_line + command.count('\n')

        relative_path = get_relative_path(file_path, base_dir)
        command_content = command.strip()
        chunks.append(Chunk(
            id=str(uuid.uuid4()),
            chunk_hash=generate_chunk_hash(command_content),
            relative_path=relative_path,
            start_line=start_line,
            end_line=end_line,
            content=command_content
        ))

    return chunks

def chunk_config_file(content: str, file_path: str, base_dir: str) -> List[Chunk]:
    """Treat config files as single chunks."""
    relative_path = get_relative_path(file_path, base_dir)
    
    return [Chunk(
        id=str(uuid.uuid4()),
        chunk_hash=generate_chunk_hash(content),
        relative_path=relative_path,
        start_line=1,
        end_line=len(content.splitlines()),
        content=content
    )]

def process_file(file_path: str, base_dir: str) -> tuple[List[Chunk], List[Chunk]]:
    code_chunks = []
    non_code_chunks = []
    relative_path = os.path.relpath(file_path, base_dir)
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return [], []

    file_name = os.path.basename(file_path)
    extension = os.path.splitext(file_path)[1].lower()

    if extension in CODE_SPLITTER_EXTENSIONS or extension in TREE_SITTER_EXTENSIONS:
        code_chunks.extend(chunk_code_file(file_path, base_dir))
    
    elif extension in NON_CODE_EXTENSIONS:
        if extension == '.md':
            non_code_chunks.extend(chunk_markdown(content, file_path, base_dir))
        elif extension in ['.yaml', '.yml', '.toml', '.env']:
            non_code_chunks.extend(chunk_config_file(content, file_path, base_dir))

    elif file_name == 'Dockerfile':
        non_code_chunks.extend(chunk_dockerfile(content, file_path, base_dir))

    return code_chunks, non_code_chunks

def chunk_repository(repo_path: str, output_file: str, error_file: str) -> None:
    if not os.path.exists(repo_path) or not os.path.isdir(repo_path):
        return
    
    code_chunks = []
    non_code_chunks = []
    errors = []
    processed_files = set()
    
    for root, _, files in os.walk(repo_path):
        for file in files:
            file_path = os.path.join(root, file)
            try:
                file_code_chunks, file_non_code_chunks = process_file(file_path, repo_path)
                code_chunks.extend(file_code_chunks)
                non_code_chunks.extend(file_non_code_chunks)
                if file_code_chunks or file_non_code_chunks:
                    processed_files.add(os.path.relpath(file_path, repo_path))
            except Exception as e:
                errors.append({
                    'file_path': os.path.relpath(file_path, repo_path),
                    'error': str(e)
                })
    
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    os.makedirs(os.path.dirname(error_file), exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump([chunk.to_dict() for chunk in code_chunks + non_code_chunks], f, indent=2)

    code_output_file = output_file.replace('.json', '.code.json')
    with open(code_output_file, 'w', encoding='utf-8') as f:
        json.dump([chunk.to_dict() for chunk in code_chunks], f, indent=2)

    non_code_output_file = output_file.replace('.json', '.noncode.json')
    with open(non_code_output_file, 'w', encoding='utf-8') as f:
        json.dump([chunk.to_dict() for chunk in non_code_chunks], f, indent=2)
    
    with open(error_file, 'w', encoding='utf-8') as f:
        json.dump(errors, f, indent=2)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(1)
        
    repo_path = sys.argv[1]
    output_file = sys.argv[2]
    error_file = sys.argv[3]
    
    chunk_repository(repo_path, output_file, error_file) 