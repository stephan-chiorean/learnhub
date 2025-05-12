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

from code_splitter import TiktokenSplitter, Language
from tree_sitter_languages import get_parser
import tree_sitter_languages
print("📦 tree_sitter_languages is loaded from:", tree_sitter_languages.__file__)


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
}

# Dynamically load tree-sitter languages
TREE_SITTER_LANGUAGES = {}
TREE_SITTER_PARSERS = {}  # Cache for parsers

try:
    # Register each language using tree_sitter_languages
    for lang_name in ['typescript', 'tsx', 'java']:
        print(f"Loading language: {lang_name}")
        parser = get_parser(lang_name)
        if parser:
            TREE_SITTER_PARSERS[lang_name] = parser
            print(f"✅ Loaded language: {lang_name}")
        else:
            print(f"❌ Failed to load language: {lang_name}")
except Exception as e:
    print(f"Warning: Failed to load tree-sitter languages: {e}")
    print("Tree-sitter based chunking will be disabled")

NON_CODE_EXTENSIONS = {
    'Dockerfile': 'dockerfile',
    '.json': 'config',
    '.yaml': 'config',
    '.yml': 'config',
    '.toml': 'config',
    '.env': 'config',
}

@dataclass
class Chunk:
    id: str
    file_path: str
    file_name: str
    relative_dir: str
    extension: str
    type: str
    text: str
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    size: Optional[int] = None
    is_test_file: Optional[bool] = None
    zone_guess: str = ""
    function_name: Optional[str] = None

    def to_dict(self) -> Dict:
        return {k: v for k, v in asdict(self).items() if v is not None}

@dataclass
class CodeChunk(Chunk):
    start_line: int
    end_line: int
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

class ChunkType(Enum):
    CODE = "code"
    MARKDOWN = "markdown"
    DOCKERFILE = "dockerfile"
    CONFIG = "config"

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

def chunk_with_tree_sitter(content: str, language: str, file_path: str, base_dir: str) -> List[Chunk]:
    """Chunk a file using tree-sitter AST parsing."""
    if language not in TREE_SITTER_PARSERS:
        print(f"Warning: Tree-sitter language {language} not loaded")
        return []

    # Use the cached parser
    parser = TREE_SITTER_PARSERS[language]
    source_bytes = content.encode('utf-8')
    tree = parser.parse(source_bytes)
    
    chunks = []
    relative_path = get_relative_path(file_path, base_dir)
    
    # Define the node types to look for based on language
    if language in ['typescript', 'tsx']:
        node_types = ['function_declaration', 'method_definition', 'class_declaration']
    elif language == 'java':
        node_types = ['method_declaration', 'class_declaration']
    else:
        return []

    def process_node(node):
        if node.type in node_types:
            start_line = node.start_point[0] + 1
            end_line = node.end_point[0] + 1
            node_text = source_bytes[node.start_byte:node.end_byte].decode('utf8')
            
            # Try to get function/class name
            function_name = None
            if node.type in ['function_declaration', 'method_definition', 'method_declaration']:
                name_node = node.child_by_field_name('name')
                if name_node:
                    function_name = name_node.text.decode('utf8')
            
            chunks.append(CodeChunk(
                id=str(uuid.uuid4()),
                file_path=relative_path,
                file_name=os.path.basename(file_path),
                relative_dir=os.path.dirname(relative_path),
                extension=os.path.splitext(file_path)[1].lower(),
                type=ChunkType.CODE.value,
                text=node_text,
                start_line=start_line,
                end_line=end_line,
                size=len(node_text),
                is_test_file=is_test_file(file_path),
                function_name=function_name,
                language=language
            ))
        
        for child in node.children:
            process_node(child)

    process_node(tree.root_node)
    return chunks

def chunk_code_file(file_path: str, base_dir: str) -> List[Chunk]:
    """Chunk a code file using either code-splitter or tree-sitter."""
    extension = os.path.splitext(file_path)[1].lower()
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return []

    # Handle code-splitter languages
    if extension in CODE_SPLITTER_EXTENSIONS:
        language = CODE_SPLITTER_EXTENSIONS[extension]
        splitter = TiktokenSplitter(language=language, max_size=8192)
        chunks = []
        
        for chunk in splitter.split(content):
            relative_path = get_relative_path(file_path, base_dir)
            chunks.append(CodeChunk(
                id=str(uuid.uuid4()),
                file_path=relative_path,
                file_name=os.path.basename(file_path),
                relative_dir=os.path.dirname(relative_path),
                extension=extension,
                type=ChunkType.CODE.value,
                text=chunk.text,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
                size=len(chunk.text),
                is_test_file=is_test_file(file_path),
                language=language.name.lower()
            ))
        return chunks
    
    # Handle tree-sitter languages
    elif extension in TREE_SITTER_EXTENSIONS:
        language = TREE_SITTER_EXTENSIONS[extension]
        return chunk_with_tree_sitter(content, language, file_path, base_dir)
    
    return []

def chunk_markdown(content: str, file_path: str, base_dir: str) -> List[Chunk]:
    """Split markdown files by headings."""
    sections = re.split(r'^#{2,3}\s+', content, flags=re.MULTILINE)
    chunks = []
    
    for i, section in enumerate(sections):
        if not section.strip():
            continue

        # Approximate line numbers
        start_line = content[:content.find(section)].count('\n') + 1
        end_line = start_line + section.count('\n')

        relative_path = get_relative_path(file_path, base_dir)
        chunks.append(Chunk(
            id=str(uuid.uuid4()),
            file_path=relative_path,
            file_name=os.path.basename(file_path),
            relative_dir=os.path.dirname(relative_path),
            extension='.md',
            type=ChunkType.MARKDOWN.value,
            text=section.strip(),
            start_line=start_line,
            end_line=end_line
        ))

    return chunks

def chunk_dockerfile(content: str, file_path: str, base_dir: str) -> List[Chunk]:
    """Split Dockerfile by commands."""
    commands = re.split(r'\n(?=RUN |ARG |ENV |COPY |ENTRYPOINT |CMD |FROM |WORKDIR )', content)
    chunks = []

    for i, command in enumerate(commands):
        if not command.strip():
            continue

        # Approximate line numbers
        start_line = content[:content.find(command)].count('\n') + 1
        end_line = start_line + command.count('\n')

        relative_path = get_relative_path(file_path, base_dir)
        chunks.append(Chunk(
            id=str(uuid.uuid4()),
            file_path=relative_path,
            file_name=os.path.basename(file_path),
            relative_dir=os.path.dirname(relative_path),
            extension='',
            type=ChunkType.DOCKERFILE.value,
            text=command.strip(),
            start_line=start_line,
            end_line=end_line
        ))

    return chunks

def chunk_config_file(content: str, file_path: str, base_dir: str) -> List[Chunk]:
    """Treat config files as single chunks."""
    relative_path = get_relative_path(file_path, base_dir)
    extension = os.path.splitext(file_path)[1].lower()
    
    return [Chunk(
        id=str(uuid.uuid4()),
        file_path=relative_path,
        file_name=os.path.basename(file_path),
        relative_dir=os.path.dirname(relative_path),
        extension=extension,
        type=ChunkType.CONFIG.value,
        text=content.strip()
    )]

def process_file(file_path: str, base_dir: str) -> tuple[List[Chunk], List[Chunk]]:
    """Process a single file and return code and non-code chunks."""
    code_chunks = []
    non_code_chunks = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return [], []

    file_name = os.path.basename(file_path)
    extension = os.path.splitext(file_path)[1].lower()
    # Handle code files
    if extension in CODE_SPLITTER_EXTENSIONS or extension in TREE_SITTER_EXTENSIONS:
        code_chunks.extend(chunk_code_file(file_path, base_dir))
    
    # Handle non-code files
    elif extension in NON_CODE_EXTENSIONS:
        if extension == '.md':
            non_code_chunks.extend(chunk_markdown(content, file_path, base_dir))
        elif extension in ['.json', '.yaml', '.yml', '.toml', '.env']:
            non_code_chunks.extend(chunk_config_file(content, file_path, base_dir))
    elif file_name == 'Dockerfile':
        non_code_chunks.extend(chunk_dockerfile(content, file_path, base_dir))

    return code_chunks, non_code_chunks

def chunk_repository(repo_path: str, output_file: str, error_file: str) -> None:
    print(f"Chunking repository: {repo_path}")

    print(f"🔍 Checking repository path: {repo_path}")

    if not os.path.exists(repo_path):
        print(f"❌ ERROR: Path does not exist: {repo_path}")
        return

    if not os.path.isdir(repo_path):
        print(f"❌ ERROR: Path is not a directory: {repo_path}")
        return

    """Main function to chunk a repository."""
    contents = os.listdir(repo_path)
    print(f"✅ Directory exists and contains {len(contents)} items:")
    for item in contents:
        print(f"  - {item}")

    print(f"📦 Starting to walk files recursively...\n")
    code_chunks = []
    non_code_chunks = []
    errors = []
    
    for root, _, files in os.walk(repo_path):
        for file in files:
            file_path = os.path.join(root, file)
            try:
                file_code_chunks, file_non_code_chunks = process_file(file_path, repo_path)
                code_chunks.extend(file_code_chunks)
                non_code_chunks.extend(file_non_code_chunks)
            except Exception as e:
                errors.append({
                    'file_path': os.path.relpath(file_path, repo_path),
                    'error': str(e)
                })
                print(f"Error processing file {file_path}: {e}")

    # Write output files
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    os.makedirs(os.path.dirname(error_file), exist_ok=True)
    
    # Write combined output
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump([chunk.to_dict() for chunk in code_chunks + non_code_chunks], f, indent=2)

    # ALSO write code-only chunks
    code_output_file = output_file.replace('.json', '.code.json')
    with open(code_output_file, 'w', encoding='utf-8') as f:
        json.dump([chunk.to_dict() for chunk in code_chunks], f, indent=2)

    # Optionally: write non-code-only chunks
    non_code_output_file = output_file.replace('.json', '.noncode.json')
    with open(non_code_output_file, 'w', encoding='utf-8') as f:
        json.dump([chunk.to_dict() for chunk in non_code_chunks], f, indent=2)
    
    # Write errors to error file
    with open(error_file, 'w', encoding='utf-8') as f:
        json.dump(errors, f, indent=2)

    print(f"✅ Processed {len(code_chunks)} code chunks and {len(non_code_chunks)} non-code chunks")
    print(f"✅ Output written to: {output_file}")
    print(f"✅ Errors written to: {error_file}")

if __name__ == "__main__":
    # Comment out current implementation
    # if len(sys.argv) != 4:
    #     print('Usage: python chunk_repo_unified.py <repoDir> <outputFile> <errorFile>')
    #     sys.exit(1)
    #     
    # repo_path = sys.argv[1]
    # output_file = sys.argv[2]
    # error_file = sys.argv[3]
    
    # Hardcoded paths for testing
    repo_path = "/tmp/walkthrough/stephan-chiorean_PromptVaultAdmin"
    output_file = "/tmp/walkthrough/PromptVaultAdmin_chunks.json"
    code_output_file = output_file.replace('.json', '.code.json')
    error_file = "/tmp/walkthrough/PromptVaultAdmin_errors.json"
    
    print(f"Testing with hardcoded paths:")
    print(f"Repo path: {repo_path}")
    print(f"Output file: {output_file}")
    print(f"Error file: {error_file}")
    
    chunk_repository(repo_path, output_file, error_file) 