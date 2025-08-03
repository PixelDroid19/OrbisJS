import {
  CompletionContext,
  CompletionResult,
  autocompletion,
  Completion,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { Extension } from "@codemirror/state";
import {
  localCompletionSource,
  scopeCompletionSource,
  snippets,
  typescriptSnippets,
} from "@codemirror/lang-javascript";

export class CompletionService {
  /**
   * Obtiene las extensiones de autocompletado para JavaScript usando LRLanguage
   */
  public static getJavaScriptCompletions(): Extension {
    return [
      // Consolidar todas las fuentes de autocompletado en una sola extensión
      autocompletion({
        override: [
          // Completaciones personalizadas (prioridad alta)
          CompletionService.createCustomCompletionSource(),
          // JSDoc completions integradas
          CompletionService.createJSDocCompletionSource(),
          // Snippets nativos de JavaScript
          CompletionService.createSnippetSource(snippets),
          // Completaciones nativas como fallback
          localCompletionSource,
          scopeCompletionSource(globalThis),
        ],
        activateOnTyping: true,
        maxRenderedOptions: 20,
      }),
    ];
  }

  /**
   * Obtiene las extensiones de autocompletado para TypeScript usando LRLanguage
   */
  public static getTypeScriptCompletions(): Extension {
    return [
      // Consolidar todas las fuentes de autocompletado en una sola extensión
      autocompletion({
        override: [
          // Completaciones personalizadas (prioridad alta)
          CompletionService.createCustomCompletionSource(),
          // Completaciones específicas de TypeScript
          CompletionService.createTypeScriptCompletionSource(),
          // JSDoc completions integradas
          CompletionService.createJSDocCompletionSource(),
          // Snippets nativos de TypeScript (incluye los de JavaScript)
          CompletionService.createSnippetSource(typescriptSnippets),
          // Completaciones nativas como fallback
          localCompletionSource,
          scopeCompletionSource(globalThis),
        ],
        activateOnTyping: true,
        maxRenderedOptions: 20,
      }),
    ];
  }

  /**
   * Fuente de snippets consolidada
   */
  private static createSnippetSource(snippetOptions: readonly Completion[]) {
    return (context: CompletionContext) => {
      const word = context.matchBefore(/\w*/);
      if (!word || (word.from == word.to && !context.explicit)) {
        return null;
      }

      return {
        from: word.from,
        options: snippetOptions,
        validFor: /^\w*$/,
      };
    };
  }

  /**
   * Fuente de completado personalizada para JavaScript
   */
  private static createCustomCompletionSource() {
    return (context: CompletionContext): CompletionResult | null => {
      const word = context.matchBefore(/\w*/);

      if (!word || (word.from == word.to && !context.explicit)) {
        return null;
      }

      // Detectar el contexto analizando el texto antes del cursor
      const textBefore = context.state.sliceDoc(
        Math.max(0, context.pos - 50),
        context.pos
      );

      // Detectar si estamos después de "console."
      const isAfterConsole = /console\.\w*$/.test(textBefore);

      if (isAfterConsole) {
        // Solo mostrar métodos de console cuando estamos después de "console."
        const consoleCompletions = [
          {
            label: "log",
            type: "method",
            apply: "log(${cursor})",
            detail: "Log to console",
          },
          {
            label: "error",
            type: "method",
            apply: "error(${cursor})",
            detail: "Log error",
          },
          {
            label: "warn",
            type: "method",
            apply: "warn(${cursor})",
            detail: "Log warning",
          },
          {
            label: "info",
            type: "method",
            apply: "info(${cursor})",
            detail: "Log info",
          },
          {
            label: "debug",
            type: "method",
            apply: "debug(${cursor})",
            detail: "Log debug",
          },
          {
            label: "table",
            type: "method",
            apply: "table(${cursor})",
            detail: "Log as table",
          },
          {
            label: "trace",
            type: "method",
            apply: "trace(${cursor})",
            detail: "Log stack trace",
          },
          {
            label: "assert",
            type: "method",
            apply: "assert(${cursor})",
            detail: "Assert condition",
          },
          {
            label: "clear",
            type: "method",
            apply: "clear()",
            detail: "Clear console",
          },
          {
            label: "count",
            type: "method",
            apply: "count(${cursor})",
            detail: "Count occurrences",
          },
          {
            label: "countReset",
            type: "method",
            apply: "countReset(${cursor})",
            detail: "Reset counter",
          },
          {
            label: "dir",
            type: "method",
            apply: "dir(${cursor})",
            detail: "Display object properties",
          },
          {
            label: "dirxml",
            type: "method",
            apply: "dirxml(${cursor})",
            detail: "Display XML/HTML element",
          },
          {
            label: "group",
            type: "method",
            apply: "group(${cursor})",
            detail: "Start log group",
          },
          {
            label: "groupCollapsed",
            type: "method",
            apply: "groupCollapsed(${cursor})",
            detail: "Start collapsed group",
          },
          {
            label: "groupEnd",
            type: "method",
            apply: "groupEnd()",
            detail: "End log group",
          },
          {
            label: "time",
            type: "method",
            apply: "time(${cursor})",
            detail: "Start timer",
          },
          {
            label: "timeEnd",
            type: "method",
            apply: "timeEnd(${cursor})",
            detail: "End timer",
          },
          {
            label: "timeLog",
            type: "method",
            apply: "timeLog(${cursor})",
            detail: "Log timer",
          },
        ];

        return {
          from: word.from,
          options: consoleCompletions,
          validFor: /^\w*$/,
        };
      }

      // Detectar si estamos después de Promise.
      const isAfterPromise = /Promise\.\w*$/.test(textBefore);

      if (isAfterPromise) {
        const promiseCompletions = [
          {
            label: "resolve",
            type: "method",
            apply: "resolve(${cursor})",
            detail: "Resolved promise",
          },
          {
            label: "reject",
            type: "method",
            apply: "reject(${cursor})",
            detail: "Rejected promise",
          },
          {
            label: "all",
            type: "method",
            apply: "all([${cursor}])",
            detail: "Wait for all promises",
          },
          {
            label: "race",
            type: "method",
            apply: "race([${cursor}])",
            detail: "Race promises",
          },
          {
            label: "allSettled",
            type: "method",
            apply: "allSettled([${cursor}])",
            detail: "Wait for all to settle",
          },
          {
            label: "any",
            type: "method",
            apply: "any([${cursor}])",
            detail: "First fulfilled promise",
          },
        ];

        return {
          from: word.from,
          options: promiseCompletions,
          validFor: /^\w*$/,
        };
      }

      // Detectar si estamos después de una variable que es un array o después de Array.
      // Mejorar la detección para variables como 'ar.', 'arr.', 'array.', etc.
      const isAfterArrayVariable = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\.\w*$/.test(
        textBefore
      );
      const isAfterArrayConstructor = /Array\.\w*$/.test(textBefore);
      const isAfterArrayLiteral = /\[\]?\.\w*$/.test(textBefore);

      if (
        isAfterArrayVariable ||
        isAfterArrayConstructor ||
        isAfterArrayLiteral
      ) {
        // Verificar si la variable podría ser un array basándose en el contexto
        const variableMatch = textBefore.match(
          /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\.\w*$/
        );
        const isLikelyArray =
          variableMatch &&
          (variableMatch[1].toLowerCase().includes("arr") ||
            variableMatch[1].toLowerCase().includes("list") ||
            variableMatch[1].toLowerCase().includes("items") ||
            variableMatch[1] === "ar" ||
            isAfterArrayConstructor ||
            isAfterArrayLiteral);

        if (isLikelyArray || isAfterArrayConstructor || isAfterArrayLiteral) {
          const arrayCompletions = [
            {
              label: "map",
              type: "method",
              apply: "map(${cursor} => )",
              detail: "Transform array",
            },
            {
              label: "filter",
              type: "method",
              apply: "filter(${cursor} => )",
              detail: "Filter array",
            },
            {
              label: "reduce",
              type: "method",
              apply: "reduce((acc, ${cursor}) => )",
              detail: "Reduce array",
            },
            {
              label: "forEach",
              type: "method",
              apply: "forEach(${cursor} => )",
              detail: "Iterate array",
            },
            {
              label: "find",
              type: "method",
              apply: "find(${cursor} => )",
              detail: "Find element",
            },
            {
              label: "some",
              type: "method",
              apply: "some(${cursor} => )",
              detail: "Test some elements",
            },
            {
              label: "every",
              type: "method",
              apply: "every(${cursor} => )",
              detail: "Test all elements",
            },
            {
              label: "includes",
              type: "method",
              apply: "includes(${cursor})",
              detail: "Check if includes",
            },
            {
              label: "indexOf",
              type: "method",
              apply: "indexOf(${cursor})",
              detail: "Find index",
            },
            {
              label: "lastIndexOf",
              type: "method",
              apply: "lastIndexOf(${cursor})",
              detail: "Find last index",
            },
            {
              label: "push",
              type: "method",
              apply: "push(${cursor})",
              detail: "Add to end",
            },
            {
              label: "pop",
              type: "method",
              apply: "pop()",
              detail: "Remove from end",
            },
            {
              label: "shift",
              type: "method",
              apply: "shift()",
              detail: "Remove from start",
            },
            {
              label: "unshift",
              type: "method",
              apply: "unshift(${cursor})",
              detail: "Add to start",
            },
            {
              label: "slice",
              type: "method",
              apply: "slice(${cursor})",
              detail: "Extract section",
            },
            {
              label: "splice",
              type: "method",
              apply: "splice(${cursor})",
              detail: "Change contents",
            },
            {
              label: "join",
              type: "method",
              apply: "join(${cursor})",
              detail: "Join elements",
            },
            {
              label: "sort",
              type: "method",
              apply: "sort(${cursor})",
              detail: "Sort array",
            },
            {
              label: "reverse",
              type: "method",
              apply: "reverse()",
              detail: "Reverse array",
            },
            {
              label: "concat",
              type: "method",
              apply: "concat(${cursor})",
              detail: "Concatenate arrays",
            },
            {
              label: "flat",
              type: "method",
              apply: "flat(${cursor})",
              detail: "Flatten array",
            },
            {
              label: "flatMap",
              type: "method",
              apply: "flatMap(${cursor} => )",
              detail: "Map and flatten",
            },
            {
              label: "length",
              type: "property",
              apply: "length",
              detail: "Array length",
            },
          ];

          return {
            from: word.from,
            options: arrayCompletions,
            validFor: /^\w*$/,
          };
        }
      }

      // Solo mostrar completaciones generales si no estamos en un contexto específico
      const generalCompletions = [
        // Timing functions
        {
          label: "setTimeout",
          type: "function",
          apply: "setTimeout(() => {\n  ${cursor}\n}, 1000)",
          detail: "Delayed execution",
        },
        {
          label: "setInterval",
          type: "function",
          apply: "setInterval(() => {\n  ${cursor}\n}, 1000)",
          detail: "Repeated execution",
        },
        {
          label: "clearTimeout",
          type: "function",
          apply: "clearTimeout(${cursor})",
          detail: "Clear timeout",
        },
        {
          label: "clearInterval",
          type: "function",
          apply: "clearInterval(${cursor})",
          detail: "Clear interval",
        },

        // Fetch API
        {
          label: "fetch",
          type: "function",
          apply: "fetch('${cursor}')",
          detail: "HTTP request",
        },

        // Modern JavaScript features
        {
          label: "async function",
          type: "keyword",
          apply: "async function ${cursor}() {\n  \n}",
          detail: "Async function",
        },
        {
          label: "await",
          type: "keyword",
          apply: "await ${cursor}",
          detail: "Await expression",
        },
        {
          label: "try...catch",
          type: "keyword",
          apply:
            "try {\n  ${cursor}\n} catch (error) {\n  console.error(error);\n}",
          detail: "Error handling",
        },
      ];

      return {
        from: word.from,
        options: generalCompletions,
        validFor: /^\w*$/,
      };
    };
  }

  /**
   * Fuente de completado personalizada para TypeScript
   */
  private static createTypeScriptCompletionSource() {
    return (context: CompletionContext): CompletionResult | null => {
      const word = context.matchBefore(/\w*/);

      if (!word || (word.from == word.to && !context.explicit)) {
        return null;
      }

      // Completaciones específicas de TypeScript
      const typeScriptCompletions = [
        // Type annotations
        {
          label: "interface",
          type: "keyword",
          apply: "interface ${cursor} {\n  \n}",
          detail: "Interface definition",
        },
        {
          label: "type",
          type: "keyword",
          apply: "type ${cursor} = ",
          detail: "Type alias",
        },
        {
          label: "enum",
          type: "keyword",
          apply: "enum ${cursor} {\n  \n}",
          detail: "Enum definition",
        },
        {
          label: "class",
          type: "keyword",
          apply: "class ${cursor} {\n  constructor() {\n    \n  }\n}",
          detail: "Class definition",
        },

        // Generic types
        {
          label: "Array<T>",
          type: "type",
          apply: "Array<${cursor}>",
          detail: "Generic array type",
        },
        {
          label: "Promise<T>",
          type: "type",
          apply: "Promise<${cursor}>",
          detail: "Generic promise type",
        },
        {
          label: "Record<K,V>",
          type: "type",
          apply: "Record<${cursor}, >",
          detail: "Record type",
        },

        // Utility types
        {
          label: "Partial<T>",
          type: "type",
          apply: "Partial<${cursor}>",
          detail: "Make all properties optional",
        },
        {
          label: "Required<T>",
          type: "type",
          apply: "Required<${cursor}>",
          detail: "Make all properties required",
        },
        {
          label: "Pick<T,K>",
          type: "type",
          apply: "Pick<${cursor}, >",
          detail: "Pick specific properties",
        },
        {
          label: "Omit<T,K>",
          type: "type",
          apply: "Omit<${cursor}, >",
          detail: "Omit specific properties",
        },

        // Function types
        {
          label: "=>",
          type: "operator",
          apply: "(${cursor}) => ",
          detail: "Arrow function type",
        },
        {
          label: "as",
          type: "keyword",
          apply: "as ${cursor}",
          detail: "Type assertion",
        },
      ];

      return {
        from: word.from,
        options: typeScriptCompletions,
        validFor: /^\w*$/,
      };
    };
  }

  private static createJSDocCompletionSource() {
    return (context: CompletionContext): CompletionResult | null => {
      const nodeBefore = syntaxTree(context.state).resolveInner(
        context.pos,
        -1
      );
      if (
        nodeBefore.name != "BlockComment" ||
        context.state.sliceDoc(nodeBefore.from, nodeBefore.from + 3) != "/**"
      )
        return null;

      const textBefore = context.state.sliceDoc(nodeBefore.from, context.pos);
      const tagBefore = /@\w*$/.exec(textBefore);
      if (!tagBefore && !context.explicit) return null;

      const tagOptions = [
        {
          label: "@param",
          apply: "@param {${cursor}} name - Description",
          detail: "Parameter documentation",
        },
        {
          label: "@returns",
          apply: "@returns {${cursor}} Description",
          detail: "Return value documentation",
        },
        {
          label: "@type",
          apply: "@type {${cursor}}",
          detail: "Type annotation",
        },
        {
          label: "@example",
          apply: "@example\n// ${cursor}",
          detail: "Usage example",
        },
        {
          label: "@description",
          apply: "@description ${cursor}",
          detail: "Function description",
        },
        {
          label: "@deprecated",
          apply: "@deprecated ${cursor}",
          detail: "Deprecation notice",
        },
        {
          label: "@throws",
          apply: "@throws {${cursor}} Description",
          detail: "Exception documentation",
        },
        { label: "@see", apply: "@see ${cursor}", detail: "Reference link" },
        { label: "@private", apply: "@private", detail: "Private member" },
        { label: "@public", apply: "@public", detail: "Public member" },
        { label: "@static", apply: "@static", detail: "Static member" },
        { label: "@async", apply: "@async", detail: "Async function" },
      ];

      return {
        from: tagBefore ? nodeBefore.from + tagBefore.index : context.pos,
        options: tagOptions,
        validFor: /^(@\w*)?$/,
      };
    };
  }
}
