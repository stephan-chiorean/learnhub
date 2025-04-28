export const getLanguageFromPath = (filePath: string): string => {
  if (!filePath) return 'plaintext';

  let extension = filePath.split('/').pop()?.toLowerCase();

  if(extension?.includes('.')) {
    extension = extension.split('.').pop()?.toLowerCase();
  }
  
  const languageMap: { [key: string]: string } = {
    // Common web languages
    'js': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'json': 'json',
    
    // Backend languages
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rb': 'ruby',
    'php': 'php',
    
    // Configuration files
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'env': 'plaintext',
    
    // Build and deployment
    'dockerfile': 'dockerfile',
    'docker': 'dockerfile',
    'sh': 'bash',
    'bash': 'bash',
    
    // Markup and documentation
    'md': 'markdown',
    'markdown': 'markdown',
    
    // Database
    'sql': 'sql',
    
    // Default to plaintext if no match
    'txt': 'plaintext'
  };

  return languageMap[extension || ''] || 'plaintext';
}; 