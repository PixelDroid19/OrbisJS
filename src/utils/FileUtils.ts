/**
 * FileUtils - Utilidades centralizadas para manejo de archivos
 * Elimina duplicación de lógica de nombres de archivo y extensiones
 */

import type { LanguageType } from '../../core/editor/index.js';

/**
 * Mapeo de lenguajes a extensiones de archivo
 */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  'javascript': 'js',
  'typescript': 'ts',
  'jsx': 'jsx',
  'tsx': 'tsx',
  'json': 'json',
  'css': 'css',
  'html': 'html',
  'vue': 'vue',
  'svelte': 'svelte',
  'markdown': 'md',
  'yaml': 'yml',
  'xml': 'xml'
};

/**
 * Mapeo de LanguageType del editor a extensiones
 */
const EDITOR_LANGUAGE_EXTENSIONS: Record<LanguageType, string> = {
  'javascript': 'js',
  'typescript': 'ts',
  'json': 'json',
  'css': 'css',
  'html': 'html'
};

/**
 * Genera un nombre de archivo basado en el nombre del tab y el lenguaje detectado
 */
export function generateFileName(tabName: string, detectedLanguage: string): string {
  const extension = getLanguageExtension(detectedLanguage);
  
  // Si el tab ya tiene una extensión, usarla
  if (tabName.includes('.')) {
    return tabName;
  }
  
  return `${tabName}.${extension}`;
}

/**
 * Genera un nombre de archivo basado en el LanguageType del editor
 */
export function generateFileNameFromEditorLanguage(tabName: string, editorLanguage: LanguageType): string {
  const extension = getEditorLanguageExtension(editorLanguage);
  
  // Si el tab ya tiene una extensión, usarla
  if (tabName.includes('.')) {
    return tabName;
  }
  
  return `${tabName}.${extension}`;
}

/**
 * Obtiene la extensión de archivo para un lenguaje detectado
 */
export function getLanguageExtension(language: string): string {
  return LANGUAGE_EXTENSIONS[language.toLowerCase()] || 'js';
}

/**
 * Obtiene la extensión de archivo para un LanguageType del editor
 */
export function getEditorLanguageExtension(editorLanguage: LanguageType): string {
  return EDITOR_LANGUAGE_EXTENSIONS[editorLanguage] || 'js';
}

/**
 * Extrae la extensión de un nombre de archivo
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return '';
  }
  return filename.substring(lastDot + 1).toLowerCase();
}

/**
 * Detecta el lenguaje basado en la extensión del archivo
 */
export function detectLanguageFromExtension(filename: string): string {
  const extension = getFileExtension(filename);
  
  const extensionToLanguage: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'json': 'json',
    'css': 'css',
    'html': 'html',
    'htm': 'html',
    'vue': 'vue',
    'svelte': 'svelte',
    'md': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml',
    'xml': 'xml'
  };

  return extensionToLanguage[extension] || 'javascript';
}

/**
 * Convierte un lenguaje detectado a LanguageType del editor
 */
export function mapToEditorLanguage(detectedLanguage: string): LanguageType {
  const languageMap: Record<string, LanguageType> = {
    'javascript': 'javascript',
    'jsx': 'javascript',
    'typescript': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'css': 'css',
    'html': 'html',
    'vue': 'html',
    'svelte': 'html',
    'markdown': 'html',
    'yaml': 'json',
    'xml': 'html'
  };

  return languageMap[detectedLanguage.toLowerCase()] || 'javascript';
}

/**
 * Valida si un nombre de archivo es válido
 */
export function isValidFileName(filename: string): boolean {
  if (!filename || filename.trim().length === 0) {
    return false;
  }

  // Caracteres no permitidos en nombres de archivo
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(filename)) {
    return false;
  }

  // Nombres reservados en Windows
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];

  const nameWithoutExtension = filename.split('.')[0].toUpperCase();
  if (reservedNames.includes(nameWithoutExtension)) {
    return false;
  }

  return true;
}

/**
 * Sanitiza un nombre de archivo removiendo caracteres inválidos
 */
export function sanitizeFileName(filename: string): string {
  if (!filename) {
    return 'untitled';
  }

  // Remover caracteres inválidos
  let sanitized = filename.replace(/[<>:"/\\|?*]/g, '_');
  
  // Remover espacios al inicio y final
  sanitized = sanitized.trim();
  
  // Si queda vacío, usar nombre por defecto
  if (sanitized.length === 0) {
    return 'untitled';
  }

  return sanitized;
}

/**
 * Genera un nombre único agregando un sufijo numérico si es necesario
 */
export function generateUniqueFileName(baseName: string, existingNames: string[]): string {
  let fileName = baseName;
  let counter = 1;

  while (existingNames.includes(fileName)) {
    const extension = getFileExtension(baseName);
    const nameWithoutExtension = baseName.replace(`.${extension}`, '');
    fileName = extension 
      ? `${nameWithoutExtension}-${counter}.${extension}`
      : `${nameWithoutExtension}-${counter}`;
    counter++;
  }

  return fileName;
}