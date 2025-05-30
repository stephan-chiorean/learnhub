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
from rich.console import Console
from rich.panel import Panel

from code_splitter import TiktokenSplitter, Language
from tree_sitter_languages import get_parser
import tree_sitter_languages

# Progress tracking
start_time = time.time()
console = Console()

def emit_progress(stage: str, message: str, progress: Optional[float] = None) -> None:
    """Emit a progress event as JSON."""
    progress_event = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.%fZ", time.gmtime()),
        "stage": stage,
        "message": message,
        "elapsed": time.time() - start_time,
        "progress": progress
    }
    print(json.dumps(progress_event))

# Get the script's directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

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

def chunk_with_tree_sitter(content: str, language: str, file_path: str) -> List[Chunk]:
    """Chunk a file using tree-sitter AST parsing."""
    if language not in TREE_SITTER_PARSERS:
        print(f"Warning: Tree-sitter language {language} not loaded")
        return []

    parser = TREE_SITTER_PARSERS[language]
    source_bytes = content.encode('utf-8')
    tree = parser.parse(source_bytes)
    
    chunks = []
    
    # Define the node types to look for based on language
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
            node_text = source_bytes[node.start_byte:node.end_byte].decode('utf8')
            
            # Try to get function/class name
            function_name = None
            if node.type in ['function_declaration', 'method_definition', 'method_declaration']:
                name_node = node.child_by_field_name('name')
                if name_node:
                    function_name = name_node.text.decode('utf8')
            elif node.type in ['class_declaration', 'interface_declaration', 'type_alias_declaration', 'enum_declaration']:
                name_node = node.child_by_field_name('name')
                if name_node:
                    function_name = name_node.text.decode('utf8')
            
            chunks.append(CodeChunk(
                id=str(uuid.uuid4()),
                file_path=file_path,
                file_name=os.path.basename(file_path),
                relative_dir=os.path.dirname(file_path),
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
    
    # If no chunks were found, create a single chunk for the entire file
    if not chunks:
        chunks.append(CodeChunk(
            id=str(uuid.uuid4()),
            file_path=file_path,
            file_name=os.path.basename(file_path),
            relative_dir=os.path.dirname(file_path),
            extension=os.path.splitext(file_path)[1].lower(),
            type=ChunkType.CODE.value,
            text=content,
            start_line=1,
            end_line=len(content.splitlines()),
            size=len(content),
            is_test_file=is_test_file(file_path),
            language=language
        ))
    
    return chunks

def chunk_code_file(file_path: str) -> List[Chunk]:
    """Chunk a code file using either code-splitter or tree-sitter."""
    extension = os.path.splitext(file_path)[1].lower()
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        emit_progress("error", f"Error reading file {file_path}: {e}")
        return []

    # Handle code-splitter languages
    if extension in CODE_SPLITTER_EXTENSIONS:
        language = CODE_SPLITTER_EXTENSIONS[extension]
        splitter = TiktokenSplitter(language=language, max_size=8192)
        chunks = []
        
        for chunk in splitter.split(content):
            chunks.append(CodeChunk(
                id=str(uuid.uuid4()),
                file_path=file_path,
                file_name=os.path.basename(file_path),
                relative_dir=os.path.dirname(file_path),
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
        chunks = chunk_with_tree_sitter(content, language, file_path)
        if not chunks:
            emit_progress("skipped", f"No chunks generated for {file_path} using tree-sitter")
        return chunks
    
    # For any other code-like file, create a single chunk
    elif extension in ['.baml', '.cjs'] or file_path.endswith('.baml'):
        return [CodeChunk(
            id=str(uuid.uuid4()),
            file_path=file_path,
            file_name=os.path.basename(file_path),
            relative_dir=os.path.dirname(file_path),
            extension=extension,
            type=ChunkType.CODE.value,
            text=content,
            start_line=1,
            end_line=len(content.splitlines()),
            size=len(content),
            is_test_file=is_test_file(file_path),
            language='typescript'  # Default to typescript for these files
        )]
    
    emit_progress("skipped", f"Unsupported code file extension: {extension} for {file_path}")
    return []

def chunk_markdown(content: str, file_path: str) -> List[Chunk]:
    """Split markdown files by headings."""
    sections = re.split(r'^#{2,3}\s+', content, flags=re.MULTILINE)
    chunks = []
    
    for i, section in enumerate(sections):
        if not section.strip():
            continue

        # Approximate line numbers
        start_line = content[:content.find(section)].count('\n') + 1
        end_line = start_line + section.count('\n')

        chunks.append(Chunk(
            id=str(uuid.uuid4()),
            file_path=file_path,
            file_name=os.path.basename(file_path),
            relative_dir=os.path.dirname(file_path),
            extension='.md',
            type=ChunkType.MARKDOWN.value,
            text=section.strip(),
            start_line=start_line,
            end_line=end_line
        ))

    return chunks

def chunk_dockerfile(content: str, file_path: str) -> List[Chunk]:
    """Split Dockerfile by commands."""
    commands = re.split(r'\n(?=RUN |ARG |ENV |COPY |ENTRYPOINT |CMD |FROM |WORKDIR )', content)
    chunks = []

    for i, command in enumerate(commands):
        if not command.strip():
            continue

        # Approximate line numbers
        start_line = content[:content.find(command)].count('\n') + 1
        end_line = start_line + command.count('\n')

        chunks.append(Chunk(
            id=str(uuid.uuid4()),
            file_path=file_path,
            file_name=os.path.basename(file_path),
            relative_dir=os.path.dirname(file_path),
            extension='',
            type=ChunkType.DOCKERFILE.value,
            text=command.strip(),
            start_line=start_line,
            end_line=end_line
        ))

    return chunks

def chunk_config_file(content: str, file_path: str) -> List[Chunk]:
    """Treat config files as single chunks."""
    extension = os.path.splitext(file_path)[1].lower()
    
    return [Chunk(
        id=str(uuid.uuid4()),
        file_path=file_path,
        file_name=os.path.basename(file_path),
        relative_dir=os.path.dirname(file_path),
        extension=extension,
        type=ChunkType.CONFIG.value,
        text=content.strip()
    )]

def process_file(file_path: str) -> List[Chunk]:
    """Process a single file and return its chunks."""
    emit_progress("processing", f"Starting to process file: {file_path}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        emit_progress("error", f"Error reading file {file_path}: {str(e)}")
        return []

    file_name = os.path.basename(file_path)
    extension = os.path.splitext(file_path)[1].lower()
    chunks = []

    if extension in CODE_SPLITTER_EXTENSIONS or extension in TREE_SITTER_EXTENSIONS:
        emit_progress("processing", f"Processing code file: {file_path}")
        chunks.extend(chunk_code_file(file_path))
        if not chunks:
            emit_progress("skipped", f"No chunks generated for code file: {file_path}")
        else:
            emit_progress("complete", f"Processed code file: {file_path}")
    
    elif extension in NON_CODE_EXTENSIONS:
        emit_progress("processing", f"Processing non-code file: {file_path}")
        if extension == '.md':
            chunks.extend(chunk_markdown(content, file_path))
        elif extension in ['.yaml', '.yml', '.toml', '.env']:
            chunks.extend(chunk_config_file(content, file_path))
        if not chunks:
            emit_progress("skipped", f"No chunks generated for non-code file: {file_path}")
        else:
            emit_progress("complete", f"Processed non-code file: {file_path}")

    elif file_name == 'Dockerfile':
        emit_progress("processing", f"Processing Dockerfile: {file_path}")
        chunks.extend(chunk_dockerfile(content, file_path))
        if not chunks:
            emit_progress("skipped", f"No chunks generated for Dockerfile: {file_path}")
        else:
            emit_progress("complete", f"Processed Dockerfile: {file_path}")
    else:
        emit_progress("skipped", f"Unsupported file type: {file_path}")

    return chunks

def chunk_file(file_path: str, output_file: str) -> None:
    """Process a single file and write its chunks to the output file."""
    if not os.path.exists(file_path):
        console.print("[red]Error: File does not exist[/red]")
        return

    if not os.path.isfile(file_path):
        console.print("[red]Error: Path is not a file[/red]")
        return
    
    chunks = process_file(file_path)
    
    # Write output file
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump([chunk.to_dict() for chunk in chunks], f, indent=2)

    # Print summary
    console.print(Panel(
        f"[bold green]File Processing Complete[/bold green]\n"
        f"Total chunks: [yellow]{len(chunks)}[/yellow]\n"
        f"Total time: [cyan]{time.time() - start_time:.2f}s[/cyan]",
        border_style="green"
    ))

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print('Usage: python3 chunk_file.py <file_path> <output_file>')
        sys.exit(1)
        
    file_path = sys.argv[1]
    output_file = sys.argv[2]
    
    print(f"Processing file:")
    print(f"File path: {file_path}")
    print(f"Output file: {output_file}")
    
    chunk_file(file_path, output_file) 