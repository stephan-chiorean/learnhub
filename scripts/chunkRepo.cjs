"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('fs');
const path = require('path');
const recast = require('recast');
const { parse } = require('@babel/parser');
const { v4: uuidv4 } = require('uuid');

// Get command line arguments
const repoDir = process.argv[2];
const outputFile = process.argv[3];
const errorFile = process.argv[4];

if (!repoDir || !outputFile || !errorFile) {
    console.error('Usage: node chunkRepo.cjs <repoDir> <outputFile> <errorFile>');
    process.exit(1);
}

async function walkAndChunk(dirPath) {
    const chunks = [];
    const errors = [];
    function chunkMarkdown(content, filePath) {
        const sections = content.split(/^##?\s+/gm);
        for (const section of sections) {
            if (section.trim()) {
                chunks.push({
                    filePath,
                    type: 'markdown',
                    content: section.trim(),
                    id: uuidv4()
                });
            }
        }
    }
    function chunkDockerfile(content, filePath) {
        const blocks = content.split(/\n(?=RUN |ARG |ENV |COPY |ENTRYPOINT )/g);
        for (const block of blocks) {
            if (block.trim()) {
                chunks.push({
                    filePath,
                    type: 'dockerfile',
                    content: block.trim(),
                    id: uuidv4()
                });
            }
        }
    }
    function chunkJSFile(fullPath, filePath) {
        const code = fs.readFileSync(fullPath, 'utf-8');
        try {
            const ast = recast.parse(code, {
                parser: {
                    parse(source) {
                        return parse(source, {
                            sourceType: "module",
                            plugins: [
                                "typescript",
                                "jsx",
                                "classProperties",
                                "decorators-legacy",
                                "dynamicImport",
                                "optionalChaining",
                                "nullishCoalescingOperator",
                                "classPrivateProperties",
                                "classPrivateMethods",
                                "exportDefaultFrom",
                                "exportNamespaceFrom",
                                "asyncGenerators",
                                "functionBind",
                                "functionSent",
                                "numericSeparator",
                                "objectRestSpread",
                                "optionalCatchBinding",
                                "throwExpressions",
                                "topLevelAwait"
                            ],
                            tokens: true,
                            errorRecovery: true,
                            allowImportExportEverywhere: true,
                            allowReturnOutsideFunction: true,
                            allowSuperOutsideMethod: true,
                            allowUndeclaredExports: true,
                            ranges: true,
                            createParenthesizedExpressions: true
                        });
                    }
                }
            });
            recast.types.visit(ast, {
                visitFunctionDeclaration(pathNode) {
                    const node = pathNode.node;
                    const functionCode = recast.print(node).code;
                    chunks.push({
                        filePath,
                        type: 'function',
                        functionName: node.id?.name || 'anonymous_function',
                        content: functionCode,
                        id: uuidv4()
                    });
                    this.traverse(pathNode);
                },
                visitFunctionExpression(pathNode) {
                    const node = pathNode.node;
                    const functionCode = recast.print(node).code;
                    chunks.push({
                        filePath,
                        type: 'function',
                        functionName: 'anonymous_expression',
                        content: functionCode,
                        id: uuidv4()
                    });
                    this.traverse(pathNode);
                },
                visitArrowFunctionExpression(pathNode) {
                    const node = pathNode.node;
                    const functionCode = recast.print(node).code;
                    chunks.push({
                        filePath,
                        type: 'function',
                        functionName: 'anonymous_arrow',
                        content: functionCode,
                        id: uuidv4()
                    });
                    this.traverse(pathNode);
                },
            });
        } catch (e) {
            const error = {
                filePath,
                error: e.message || 'Unknown error',
                lineNumber: e.lineNumber,
                code: code.split('\n')[e.lineNumber - 1]?.trim()
            };
            errors.push(error);
            console.error(`Error parsing file ${filePath}:`, e.message);
        }
    }
    function walk(currentPath) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativePath = path.relative(repoDir, fullPath);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                if (entry.name === 'Dockerfile') {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    chunkDockerfile(content, relativePath);
                } else if (entry.name.endsWith('.md')) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    chunkMarkdown(content, relativePath);
                } else if (/\.(js|ts|tsx)$/i.test(entry.name)) {
                    chunkJSFile(fullPath, relativePath);
                }
            }
        }
    }
    walk(dirPath);
    fs.writeFileSync(outputFile, JSON.stringify(chunks, null, 2), 'utf-8');
    fs.writeFileSync(errorFile, JSON.stringify(errors, null, 2), 'utf-8');
    console.log(`✅ Chunks saved to: ${outputFile}`);
    console.log(`✅ Errors saved to: ${errorFile}`);
    console.log(`Total files processed: ${chunks.length + errors.length}`);
    console.log(`Successfully parsed: ${chunks.length}`);
    console.log(`Failed to parse: ${errors.length}`);
}
walkAndChunk(repoDir);
