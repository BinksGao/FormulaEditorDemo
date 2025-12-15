// src/components/FormulaEditorDemo.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { createHyperEngine, computeFormula, parseFormula } from "../lib/formulaEngine";
import "./formula-editor.css";
import {
  FUNCTIONS,
  FUNCTION_DOCS,
  FUNCTION_GROUPS,
  SAMPLE_SCHEMA,
  normalizeFormula,
} from "../utils/formulaUtils";

export default function FormulaEditorDemo() {
  const [editorFormula, setEditorFormula] = useState("");
  const hfRef = useRef<any | null>(null);
  const [preview, setPreview] = useState<string | number | null>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "ai">("edit");
  const [schema] = useState(SAMPLE_SCHEMA);
  const [lookupTable, setLookupTable] = useState<string>(SAMPLE_SCHEMA[0]?.name || "");
  const getFieldsForTable = useCallback((t: string) => schema.find((x) => x.name === t)?.fields || [], [schema]);
  const [tableListHidden, setTableListHidden] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>("");
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const tokenDecosRef = useRef<string[]>([]);
  const lookupTableRef = useRef<string>(lookupTable);
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  const [filterFnKeyword, setFilterFnKeyword] = useState<string>("");
  const [lastSelectedField, setLastSelectedField] = useState<{ field: string; displayName: string } | null>(null);
  const [tableFilterKey, setTableFilterKey] = useState<string>("");
  const [fieldFilterKey, setFieldFilterKey] = useState<string>("");
  const [fieldListHidden, setFieldListHidden] = useState<boolean>(false);
  const suppressFilterOnceRef = useRef<boolean>(false);
  const suppressFilterUntilRef = useRef<number>(0);
  const keepArgPickerUntilRef = useRef<number>(0);

  useEffect(() => {
    hfRef.current = createHyperEngine();
    // 初始尝试计算预览（如果有值）
    if (editorFormula) {
      validateAndPreview(editorFormula);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    lookupTableRef.current = lookupTable;
  }, [lookupTable]);

  /**
   * 初始化编辑器
   *
   * 参数：
   * - editor：Monaco 编辑器实例
   * - monaco：Monaco 命名空间对象
   *
   * 功能：保存实例引用、注册补全与悬浮提示、安装按键/光标监听，并进行内联高亮
   */
  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    try {
      monaco.languages.setLanguageConfiguration('plaintext', {
        wordPattern: /[^\s\[\]\(\),\.]+/,
      });
    } catch {}

    monaco.languages.registerCompletionItemProvider("plaintext", {
      triggerCharacters: ['@', '[', '.'],
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const funcSuggestions = FUNCTIONS.map((f) => ({
          label: f.name,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${f.name}(${f.params ? f.params : ""})`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: "函数",
        }));
        return { suggestions: funcSuggestions };
      },
    });

    monaco.languages.registerHoverProvider("plaintext", {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position);
        if (!word) return;
        const w = word.word;
        const fn = FUNCTIONS.find((f) => f.name === w.toUpperCase());
        if (fn) {
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [{ value: `**${fn.name}**(${fn.params})` }, { value: FUNCTION_DOCS[fn.name]?.desc || "内置函数示例说明：用于演示 hover 文案" }],
          };
        }
        return null;
      },
    });

    try {
      editor.onKeyDown((e: any) => {
        if (e?.browserEvent?.key === '，') {
          try {
            const pos = editor.getPosition();
            const model = editor.getModel();
            const sel = editor.getSelection();
            const range = sel && sel.isEmpty()
              ? { startLineNumber: pos.lineNumber, startColumn: (pos.column || 1), endLineNumber: pos.lineNumber, endColumn: (pos.column || 1) } as any
              : sel;
            editor.executeEdits('fe-comma-cnv', [{ range, text: ',', forceMoveMarkers: true }]);
            e.preventDefault();
            e.stopPropagation();
          } catch {}
          return;
        }
        if (e.keyCode === monaco.KeyCode.Backspace) {
          try {
            const pos = editor.getPosition();
            const model = editor.getModel();
            const line = model?.getLineContent(pos.lineNumber) || "";
            const left = line.slice(0, Math.max(0, (pos.column || 1) - 1));
            const m = left.match(/\[\s*[^\]]+\s*\]\s*\.\s*@[^\s\.,\)\]]+$/) || left.match(/@[^\s\.,\)\]]+$/);
            if (m && m[0]) {
              const token = String(m[0]);
              const startIdx = left.lastIndexOf(token);
              if (startIdx >= 0) {
                const startCol = startIdx + 1;
                const endCol = (pos.column || 1);
                const range = { startLineNumber: pos.lineNumber, startColumn: startCol, endLineNumber: pos.lineNumber, endColumn: endCol } as any;
                editor.executeEdits('fe-del-token', [{ range, text: '' }]);
                e.preventDefault();
                e.stopPropagation();
                try {
                  const pos2 = editor.getPosition();
                  const model2 = editor.getModel();
                  const fullLine = model2?.getLineContent(pos2.lineNumber) || "";
                  const col2 = pos2.column || 1;
                  const left2 = fullLine.slice(0, Math.max(0, col2 - 1));
                  const right2 = fullLine.slice(Math.max(0, col2 - 1));
                  const iOpen = left2.lastIndexOf('(');
                  const iCloseRel = right2.indexOf(')');
                  if (iOpen >= 0 && iCloseRel >= 0) {
                    const iClose = (col2 - 1) + iCloseRel;
                    const inner = fullLine.slice(iOpen + 1, iClose).trim();
                    if (!inner) {
                      setFieldListHidden(false);
                      setTableListHidden(false);
                      keepArgPickerUntilRef.current = Date.now() + 2000;
                      setFieldFilterKey("");
                      setTableFilterKey("");
                    }
                  }
                } catch {}
              }
            }
          } catch {}
        }
      });
    } catch {}

    try {
      editor.onDidChangeCursorPosition(() => {
        const pos = editor.getPosition();
        const model = editor.getModel();
        const line = model?.getLineContent(pos.lineNumber) || "";
        const col = pos.column || 1;
        const matches = Array.from(line.matchAll(/(cond\d+|value\d+)/ig));
        if (!matches.length) return;
        // 计算从光标到最近的分隔符（逗号或右括号）的边界
        const fromIdx = Math.max(0, col - 1);
        const nextCommaIdx = line.indexOf(',', fromIdx);
        const nextParenIdx = line.indexOf(')', fromIdx);
        const hasComma = nextCommaIdx !== -1;
        const hasParen = nextParenIdx !== -1;
        const boundaryIdx = Math.min(
          hasComma ? nextCommaIdx : Infinity,
          hasParen ? nextParenIdx : Infinity
        );
        for (const m of matches) {
          const start = ((m as RegExpMatchArray).index || 0) + 1;
          const end = start + m[0].length;
          // 光标在占位符内部 → 清除当前占位符
          if (col >= start && col <= end) {
            const range = { startLineNumber: pos.lineNumber, startColumn: start, endLineNumber: pos.lineNumber, endColumn: end } as any;
            editor.executeEdits('fe-clear-ph', [{ range, text: '' }]);
            return;
          }
          // 光标在占位符之前，且占位符位于最近分隔符之前 → 清除该占位符
          if (col <= start && start <= (isFinite(boundaryIdx) ? boundaryIdx : Number.MAX_SAFE_INTEGER)) {
            const range = { startLineNumber: pos.lineNumber, startColumn: start, endLineNumber: pos.lineNumber, endColumn: end } as any;
            editor.executeEdits('fe-clear-ph', [{ range, text: '' }]);
            return;
          }
        }
      });
    } catch {}

    // 内联高亮：将 [表].@字段、[表]、@字段 应用不同的装饰样式
    const highlightEditorTokens = () => {
      try {
        const ed = editorRef.current;
        const model = ed?.getModel();
        if (!model) return;
        const pairMatches = model.findMatches("\\[[^\\]]+\\]\\s*\\.\\s*@[^\\.()\\s]+", true, false, true, null, true) || [];
        const tableMatches = model.findMatches("\\[[^\\]]+\\]", true, false, true, null, true) || [];
        const fieldMatches = model.findMatches("@[^\\.()\\s]+", true, false, true, null, true) || [];
        const decos = [] as any[];
        // 合并样式优先
        pairMatches.forEach((m: any) => decos.push({ range: m.range, options: { inlineClassName: 'fe-token-pill' } }));
        const inPair = (r: any) => pairMatches.some((pm: any) => pm.range.startLineNumber === r.startLineNumber && r.startColumn >= pm.range.startColumn && r.endColumn <= pm.range.endColumn);
        tableMatches.forEach((m: any) => { if (!inPair(m.range)) decos.push({ range: m.range, options: { inlineClassName: 'fe-token-table' } }); });
        fieldMatches.forEach((m: any) => { if (!inPair(m.range)) decos.push({ range: m.range, options: { inlineClassName: 'fe-token-field' } }); });
        tokenDecosRef.current = ed.deltaDecorations(tokenDecosRef.current, decos);
      } catch {}
    };

    highlightEditorTokens();
  }, []);

  /**
   * 设置解析错误标记
   *
   * 参数：
   * - errors：解析错误数组，包含 message、位置等
   * - originalText：原始编辑器文本
   *
   * 功能：将解析错误映射为 Monaco 的 markers，便于在编辑器中定位问题
   */
  const setEditorMarkersFromErrors = (errors: Array<{ message: string; location?: number; start?: number; end?: number }>, originalText: string) => {
    try {
      if (!monacoRef.current || !editorRef.current) return;
      const monaco = monacoRef.current;
      const model = editorRef.current.getModel();
      // clear old
      monaco.editor.setModelMarkers(model, "formula", []);
      if (!errors || errors.length === 0) return;
      const markers = errors.map((e) => {
        // default to whole content
        let startOffset = 0;
        let endOffset = Math.min(originalText.length, 1);
        if (typeof e.location === "number") {
          // e.location usually points to an index in the normalized formula string
          // Map that index to editor offset: normalized may differ from original due to normalization.
          // To simplify: we try to locate e.location char in normalized string, then map to model offset by searching substring.
          // Here we assume parser location is relative to normalized string; we will try to find approximate position in originalText.
          const loc = Math.max(0, e.location);
          startOffset = Math.min(loc, originalText.length);
          endOffset = Math.min(loc + 1, originalText.length);
        } else if (typeof e.start === "number" && typeof e.end === "number") {
          startOffset = Math.min(e.start, originalText.length);
          endOffset = Math.min(e.end, originalText.length);
        } else {
          // fallback: mark beginning
          startOffset = 0;
          endOffset = Math.min(1, originalText.length);
        }
        // convert offsets to positions
        const startPos = model.getPositionAt(startOffset);
        const endPos = model.getPositionAt(endOffset);
        return {
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column,
          message: e.message || "语法错误",
          severity: monaco.MarkerSeverity.Error,
        };
      });
      monaco.editor.setModelMarkers(model, "formula", markers);
    } catch (err) {
      // ignore
    }
  };

  /**
   * 校验并预览公式（核心）
   *
   * 参数：
   * - raw：用户输入的原始公式字符串（不一定带开头的 =）
   *
   * 功能：标准化自定义语法，调用引擎解析与计算，设置错误标记与预览结果
   */
  const validateAndPreview = async (raw: string) => {
    setValidationError("");
    setPreview(null);
    if (!raw || !raw.trim()) {
      // clear markers
      if (monacoRef.current && editorRef.current) {
        const model = editorRef.current.getModel();
        monacoRef.current.editor.setModelMarkers(model, "formula", []);
      }
      return;
    }

    // Normalize custom syntax to HF-friendly syntax
    const normalizedNoEq = normalizeFormula(raw, schema, lookupTable);
    const normalized = normalizedNoEq.startsWith("=") ? normalizedNoEq : "=" + normalizedNoEq;

    // parse via HyperFormula
    const hf = hfRef.current;
    if (!hf) {
      setValidationError("公式引擎未初始化");
      return;
    }
    const parsed = parseFormula(hf, normalized);
    if (!parsed.ok) {
      // set markers
      setEditorMarkersFromErrors(parsed.errors || [{ message: "语法错误" }], raw);
      setValidationError((parsed.errors && parsed.errors[0] && parsed.errors[0].message) || "语法错误");
      setPreview(null);
      return;
    } else {
      // clear markers
      if (monacoRef.current && editorRef.current) {
        const model = editorRef.current.getModel();
        monacoRef.current.editor.setModelMarkers(model, "formula", []);
      }
      setValidationError("");
    }

    // compute preview
    const res: any = computeFormula(hf, normalized);
    if (!res.ok) {
      setValidationError(String(res.error || "计算失败"));
      setPreview(null);
      return;
    }
    setPreview(res.value ?? null);
  };

  /**
   * 函数签名缓存
   *
   * 功能：统计内置函数的必选/可选/可变参数数量，用于静态校验
   */
  const fnSigMap = React.useMemo(() => {
    const map: Record<string, { required: number; optional: number; variadic: boolean }> = {};
    FUNCTIONS.forEach((f) => {
      const raw = (f.params || "").trim();
      if (!raw) {
        map[f.name] = { required: 0, optional: 0, variadic: false };
        return;
      }
      const parts = raw.split(",").map((p) => p.trim());
      let variadic = parts.some((p) => p.includes("...")) || ["SWITCH", "AND", "OR", "XOR"].includes(f.name);
      let required = 0;
      let optional = 0;
      parts.forEach((p) => {
        if (p.includes("...")) return;
        if (p.endsWith("?")) optional++;
        else required++;
      });
      if (f.name === "SWITCH") {
        required = 3;
        variadic = true;
      }
      map[f.name] = { required, optional, variadic };
    });
    return map;
  }, []);

  /**
   * 提取函数调用
   *
   * 参数：
   * - expr：公式表达式（不带开头的 =）
   *
   * 返回：
   * - { name, args } 列表，表示函数名与其参数数组
   */
  const extractCalls = (expr: string) => {
    const calls: Array<{ name: string; args: string[] }> = [];
    const s = expr || "";
    let i = 0;
    while (i < s.length) {
      if (/_|[A-Za-z]/.test(s[i])) {
        let j = i;
        while (j < s.length && /_|[A-Za-z0-9]/.test(s[j])) j++;
        if (s[j] === "(") {
          let k = j + 1;
          let depth = 0;
          let inQ = false;
          let buf = "";
          const args: string[] = [];
          while (k < s.length) {
            const ch = s[k];
            if (ch === '"') inQ = !inQ;
            if (!inQ) {
              if (ch === "(") depth++;
              else if (ch === ")") {
                if (depth === 0) {
                  args.push(buf.trim());
                  buf = "";
                  k++;
                  break;
                }
                depth--;
              } else if (ch === "," && depth === 0) {
                args.push(buf.trim());
                buf = "";
                k++;
                continue;
              }
            }
            buf += ch;
            k++;
          }
          const name = s.slice(i, j);
          const normArgs = args.length === 1 && args[0] === "" ? [] : args;
          calls.push({ name, args: normArgs });
          i = k;
          continue;
        }
      }
      i++;
    }
    return calls;
  };

  /**
   * 静态参数校验
   *
   * 参数：
   * - code：用户输入的公式文本
   *
   * 返回：
   * - 错误消息字符串；无错误返回空字符串
   */
  const staticValidate = (code: string) => {
    const normalizedNoEq = normalizeFormula(code, schema, lookupTable);
    const outer = normalizedNoEq.startsWith("=") ? normalizedNoEq.slice(1) : normalizedNoEq;
    const calls = extractCalls(outer);
    for (const c of calls) {
      const name = c.name.toUpperCase();
      const sig = fnSigMap[name];
      if (!sig) return `未知函数：${c.name}`;
      const argc = c.args.length;
      const min = sig.required;
      const max = sig.variadic ? Infinity : sig.required + sig.optional;
      if (argc < min) return `函数 ${c.name} 至少需要 ${min} 个参数，当前 ${argc}`;
      if (argc > max) return `函数 ${c.name} 最多允许 ${max === Infinity ? "不限制" : max} 个参数，当前 ${argc}`;
    }
    return "";
  };

  /**
   * 更新预览值
   *
   * 参数：
   * - formula：当前公式文本
   *
   * 功能：标准化后进行一次快速计算，显示即时预览
   */
  const updatePreview = async (formula: string) => {
    try {
      const hf = hfRef.current;
      if (!hf) return;
      const normalizedNoEq = normalizeFormula(formula, schema, lookupTable);
      const normalized = normalizedNoEq.startsWith("=") ? normalizedNoEq : "=" + normalizedNoEq;
      const res = computeFormula(hf, normalized);
      if (res.ok) {
        setPreview(res?.value as string | number);
      } else {
        setPreview(null);
      }
    } catch (e) {
      setPreview(null);
    }
  };

  /**
   * 显示名转换为代码名
   *
   * 参数：
   * - code：用户输入的公式文本
   *
   * 功能：将 [表].@字段 / @字段 / 裸字段 转换为 [表代码名.字段代码名]
   */
  const transformToFieldKeys = (code: string) => {
    const getFieldKey = (table: string, disp: string) => {
      const t = schema.find((x) => x.name.toLowerCase() === table.toLowerCase());
      const f = t?.fields.find((y) => y.name === disp || y.field.toLowerCase() === disp.toLowerCase());
      return f?.field || disp;
    };
    const getFieldKeyIfExists = (table: string, disp: string) => {
      const t = schema.find((x) => x.name.toLowerCase() === table.toLowerCase());
      const f = t?.fields.find((y) => y.name === disp || y.field.toLowerCase() === disp.toLowerCase());
      return f ? f.field : null;
    };
    const getTableCode = (table: string) => {
      const t = schema.find((x) => x.name.toLowerCase() === table.toLowerCase());
      return (t && (t as any).fieldName) ? String((t as any).fieldName) : table;
    };
    const s = code;
    let out = "";
    let i = 0;
    let currentTable = "";
    const isFieldChar = (ch: string) => !(/(\.|\(|\)|\s|,|，|\]|\[)/.test(ch));
    while (i < s.length) {
      const ch = s[i];
      if (ch === "[") {
        let j = i + 1;
        while (j < s.length && s[j] !== "]") j++;
        const table = s.slice(i + 1, j);
        let k = j + 1;
        while (k < s.length && /\s/.test(s[k])) k++;
        if (k < s.length && s[k] === ".") {
          k++;
          while (k < s.length && /\s/.test(s[k])) k++;
          if (k < s.length && s[k] === ',') { k++; while (k < s.length && /\s/.test(s[k])) k++; }
          if (k < s.length && s[k] === "@") {
            let m = k + 1;
            while (m < s.length && isFieldChar(s[m])) m++;
            const disp = s.slice(k + 1, m);
            const key = getFieldKey(table, disp);
            const codeTable = getTableCode(table);
            out += `[${codeTable}.${key}]`;
            i = m;
            currentTable = table;
            continue;
          } else {
            currentTable = table;
            i = k;
            continue;
          }
        }
        out += s.slice(i, j + 1);
        currentTable = table;
        i = j + 1;
        continue;
      }
      if (ch === "@") {
        let j = i + 1;
        while (j < s.length && isFieldChar(s[j])) j++;
        const disp = s.slice(i + 1, j);
        if (currentTable) {
          const key = getFieldKey(currentTable, disp);
          const codeTable = getTableCode(currentTable);
          out += `[${codeTable}.${key}]`;
          i = j;
          continue;
        }
        if (lookupTable) {
          const key = getFieldKey(lookupTable, disp);
          const codeTable = getTableCode(lookupTable);
          out += `[${codeTable}.${key}]`;
          i = j;
          continue;
        }
        out += s.slice(i, j);
        i = j;
        continue;
      }
      // 处理无 @ 前缀的裸字段名（例如：MIN(编号，金额)）
      if (/[^\s\[\]\(\),，\.]/.test(ch)) {
        let j = i + 1;
        while (j < s.length && isFieldChar(s[j])) j++;
        const token = s.slice(i, j);
        const upper = token.toUpperCase();
        const isFunc = !!FUNCTIONS.find((f) => f.name === upper);
        if (isFunc) {
          out += token;
          i = j;
          continue;
        }
        const table = currentTable || lookupTable || "";
        if (table) {
          const key = getFieldKeyIfExists(table, token);
          if (key) {
            const codeTable = getTableCode(table);
            out += `[${codeTable}.${key}]`;
            i = j;
            continue;
          }
        }
        out += token;
        i = j;
        continue;
      }
      out += ch;
      i++;
    }
    return out;
  };

  /**
   * 确认按钮行为
   *
   * 功能：将编辑器中的公式做显示名到代码名的转换，并移除空格后输出
   */
  const validateFormula = () => {
    const code = (editorFormula || "").trim();
    const transformed = transformToFieldKeys(code);
    const noSpaces = transformed.replace(/ +/g, "");
    console.log(noSpaces);
  };

  

  /**
   * 插入函数
   *
   * 参数：
   * - name：函数名
   *
   * 功能：依据最近选择的字段智能拼接方法调用，并将光标定位到括号内
   */
  const insertFunctionToEditor = (name: string) => {
    suppressFilterOnceRef.current = true;
    suppressFilterUntilRef.current = Date.now() + 2000;
    const fn = FUNCTIONS.find((f) => f.name === name);
    let params = fn?.params || "";
    if (params.startsWith("...")) params = "";
    const method = name.toUpperCase();
    const editor = editorRef.current;
    let snippet = "";
    if (editor && lastSelectedField) {
      try {
        const pos = editor.getPosition();
        const model = editor.getModel();
        const line = model?.getLineContent(pos.lineNumber) || "";
        const left = line.slice(0, Math.max(0, (pos.column || 1) - 1));
        const trimmedLeft = left.replace(/\s+/g, "");
        // 旧判断：按字段标识匹配（已废弃）
        // 新判断：按显示名匹配；若左侧已包含 @显示名 或 [表].@显示名，则仅追加方法
        const hasFieldAnywhere = trimmedLeft.includes(`@${lastSelectedField.displayName}`);
        const hasTableFieldAnywhere = lookupTable ? trimmedLeft.includes(`[${lookupTable}].@${lastSelectedField.displayName}`) : false;
        if (hasTableFieldAnywhere || hasFieldAnywhere) {
          const needDot = !trimmedLeft.endsWith('.')
          snippet = `${needDot ? '.' : ''}${method}(${params})`;
        } else {
          if (lookupTable) snippet = `[${lookupTable}].@${lastSelectedField.displayName}.${method}(${params})`;
          else snippet = `${method}(${params})`;
        }
      } catch {
        if (lookupTable) snippet = `[${lookupTable}].@${lastSelectedField.displayName}.${method}(${params})`;
        else snippet = `${method}(${params})`;
      }
    } else {
      snippet = `${method}(${params})`;
    }
    const caretInsideParen = Math.max(0, snippet.indexOf('(') + 1);
    insertAtCursor(snippet, caretInsideParen);
    setSelectedFunction(method);
    setFieldListHidden(false);
    setTableListHidden(false);
  };

  /**
   * 插入字段
   *
   * 参数：
   * - displayName：字段显示名
   *
   * 功能：在参数上下文中智能补逗号，并避免重复表前缀；若已存在尾部结构则仅替换字段
   */
  const insertCurrentField = (displayName: string) => {
    setLastSelectedField({ field: displayName, displayName });
    suppressFilterOnceRef.current = true;
    suppressFilterUntilRef.current = Date.now() + 2000;
    setFieldFilterKey("");
    setTableFilterKey("");
    const editor = editorRef.current;
    if (editor) {
      try {
        const pos = editor.getPosition();
        const model = editor.getModel();
        const line = model?.getLineContent(pos.lineNumber) || "";
        const left = line.slice(0, Math.max(0, (pos.column || 1) - 1));
        const trimmedLeft = left.replace(/\s+/g, "");
        const openCount = (left.match(/\(/g) || []).length;
        const closeCount = (left.match(/\)/g) || []).length;
        const insideArgs = openCount > closeCount;
        const prevChar = trimmedLeft.slice(-1);
        // 若用户已输入用于过滤的字段关键字，先清除该关键字
        let startColumn = (pos.column || 1);
        let cleared = false;
        const mFieldToken = left.match(/@([^.()\s,，\]]*)$/);
        if (mFieldToken && typeof mFieldToken[1] === 'string') {
          const tok = '@' + String(mFieldToken[1]);
          startColumn = (pos.column || 1) - tok.length;
          const range = { startLineNumber: pos.lineNumber, startColumn, endLineNumber: pos.lineNumber, endColumn: startColumn + tok.length };
          editor.executeEdits('fe-field', [{ range, text: '' }]);
          cleared = true;
        } else {
          const mPlain = left.match(/([^\s\[\]\(\),\.]+)$/);
          if (mPlain && mPlain[0]) {
            const tok = String(mPlain[0]);
            startColumn = (pos.column || 1) - tok.length;
            const range = { startLineNumber: pos.lineNumber, startColumn, endLineNumber: pos.lineNumber, endColumn: startColumn + tok.length };
            editor.executeEdits('fe-field', [{ range, text: '' }]);
            cleared = true;
          }
        }
        let token = "";
        let needComma = insideArgs && prevChar !== '(' && prevChar !== ',' && prevChar !== '，';
        // 若左侧已存在 [表].@已有字段 的尾部结构，且表名与当前选中表一致：
        // - 同字段重复点击：不再追加，直接将光标定位到尾部
        // - 不同字段：仅替换 @字段 部分，避免重复 [表]. 前缀
        const tailPair = left.match(/\[\s*([^\]]+)\s*\]\s*\.\s*@([^\s\.,\)\]]+)$/);
        if (tailPair) {
          const tableInTail = String(tailPair[1]);
          const fieldInTail = String(tailPair[2]);
          if (tableInTail === lookupTable) {
            const search = '@' + fieldInTail;
            const g2StartIdx = left.lastIndexOf(search);
            if (g2StartIdx >= 0) {
              const startCol2 = g2StartIdx + 1; // 列号（1-based）
              const range2 = { startLineNumber: pos.lineNumber, startColumn: startCol2, endLineNumber: pos.lineNumber, endColumn: startCol2 + search.length };
              const newText = '@' + displayName;
              if (fieldInTail === displayName) {
                try { editor.setPosition({ lineNumber: pos.lineNumber, column: startCol2 + newText.length }); editor.focus(); } catch {}
                return;
              }
              editor.executeEdits('fe-field', [{ range: range2, text: newText }]);
              try { editor.setPosition({ lineNumber: pos.lineNumber, column: startCol2 + newText.length }); editor.focus(); } catch {}
              return;
            }
          }
        }
        if (lookupTable) {
          const hasPrefixDot = trimmedLeft.endsWith(`[${lookupTable}].`);
          const hasPrefixNoDot = trimmedLeft.endsWith(`[${lookupTable}]`);
          if (hasPrefixDot) {
            token = `@${displayName}`;
            needComma = false;
          } else if (hasPrefixNoDot) {
            token = `.@${displayName}`;
            needComma = false;
          } else {
            token = `[${lookupTable}].@${displayName}`;
          }
        } else {
          token = `@${displayName}`;
        }
        const toInsert = `${needComma ? ', ' : ''}${token}`;
        if (cleared) {
          const rangeInsert = { startLineNumber: pos.lineNumber, startColumn, endLineNumber: pos.lineNumber, endColumn: startColumn };
          editor.executeEdits('fe-field', [{ range: rangeInsert, text: toInsert }]);
          try {
            editor.setPosition({ lineNumber: pos.lineNumber, column: startColumn + toInsert.length });
            editor.focus();
          } catch {}
        } else {
          insertAtCursor(toInsert);
        }
      } catch {
        const token = lookupTable ? `[${lookupTable}].@${displayName}` : `@${displayName}`;
        insertAtCursor(token);
      }
    } else {
      const token = lookupTable ? `[${lookupTable}].@${displayName}` : `@${displayName}`;
      insertAtCursor(token);
    }
    setSelectedFunction('FILTER');
    setActiveTab('edit');
    setFilterFnKeyword('');
    try {
      const ed = editorRef.current;
      const pos = ed?.getPosition();
      const model = ed?.getModel();
      const left = (model?.getLineContent(pos?.lineNumber || 1) || "").slice(0, Math.max(0, ((pos?.column || 1) - 1)));
      const insideArgsNow = ((left.match(/\(/g) || []).length) > ((left.match(/\)/g) || []).length);
      setFieldListHidden(true);
      setTableListHidden(true);
      if (insideArgsNow) {
        // 等用户输入逗号后再通过 onEditorChange 展示列表
      }
    } catch {
      setFieldListHidden(true);
      setTableListHidden(true);
    }
  };

  /**
   * 选择数据表
   *
   * 参数：
   * - name：数据表显示名
   *
   * 功能：插入 `[表].` 前缀并更新当前选中表，参数上下文中等待逗号后再显示列表
   */
  const chooseTable = (name: string) => {
    try {
      suppressFilterOnceRef.current = true;
      suppressFilterUntilRef.current = Date.now() + 2000;
      setTableFilterKey("");
      setFieldFilterKey("");
      setLookupTable(name);
      const editor = editorRef.current;
      if (editor) {
        const pos = editor.getPosition();
        const model = editor.getModel();
        const line = model?.getLineContent(pos.lineNumber) || "";
        const left = line.slice(0, Math.max(0, (pos.column || 1) - 1));
        const trimmedLeft = left.replace(/\s+/g, "");
        const openCount = (left.match(/\(/g) || []).length;
        const closeCount = (left.match(/\)/g) || []).length;
        const insideArgs = openCount > closeCount;
        const prevChar = trimmedLeft.slice(-1);
        const needComma = insideArgs && prevChar !== '(' && prevChar !== ',' && prevChar !== '，';
        const prefix = `[${name}].`;
        const already = trimmedLeft.endsWith(prefix);
        // 若左侧为未闭合的 '[' 内容或普通最后 token（用于过滤），则先清除该片段再插入前缀
        const idxOpen = left.lastIndexOf('[');
        const idxClose = left.lastIndexOf(']');
        let replaced = false;
        let startColumn = (pos.column || 1);
        if (idxOpen > idxClose) {
          const kw = left.slice(idxOpen + 1);
          startColumn = idxOpen + 2; // 1-based 列 + 跳过 '['
          const range = { startLineNumber: pos.lineNumber, startColumn, endLineNumber: pos.lineNumber, endColumn: (pos.column || 1) };
          const text = `${prefix}`;
          editor.executeEdits('fe-table', [{ range, text }]);
          try {
            editor.setPosition({ lineNumber: pos.lineNumber, column: startColumn + text.length });
            editor.focus();
          } catch {}
          replaced = true;
        } else {
          const mTok = left.match(/([^\s\[\]\(\),\.]+)$/);
          if (mTok && mTok[0]) {
            const tok = String(mTok[0]);
            startColumn = (pos.column || 1) - tok.length;
            const range = { startLineNumber: pos.lineNumber, startColumn, endLineNumber: pos.lineNumber, endColumn: (pos.column || 1) };
            // 如果左侧已是相同前缀则不重复插入
            if (!already) {
              editor.executeEdits('fe-table', [{ range, text: prefix }]);
              try {
                editor.setPosition({ lineNumber: pos.lineNumber, column: startColumn + prefix.length });
                editor.focus();
              } catch {}
            }
            replaced = true;
          }
        }
        if (!replaced) {
          const insertText = `${(!already && needComma) ? ', ' : ''}${already ? '' : prefix}`;
          if (insertText) insertAtCursor(insertText);
        }
      } else {
        insertAtCursor(`[${name}].`);
      }
      try {
        const ed = editorRef.current;
        const pos2 = ed?.getPosition();
        const model2 = ed?.getModel();
        const left2 = (model2?.getLineContent(pos2?.lineNumber || 1) || "").slice(0, Math.max(0, ((pos2?.column || 1) - 1)));
        const insideArgsNow2 = ((left2.match(/\(/g) || []).length) > ((left2.match(/\)/g) || []).length);
        if (insideArgsNow2) {
          // 在参数内选择表后，仍然保持隐藏，等待逗号触发显示
          setFieldListHidden(true);
          setTableListHidden(true);
        }
      } catch {}
    } catch {}
  };

  

  /**
   * 编辑器变更回调
   *
   * 参数：
   * - val：编辑器当前文本
   *
   * 功能：更新公式、预览、高亮与过滤关键字，并按上下文控制列表显隐
   */
  const onEditorChange = (val: string | undefined) => {
    const raw = val || "";
    const v = raw.startsWith("=") ? raw.slice(1) : raw;
    setEditorFormula(v);
    if (!v.trim()) {
      setValidationError("");
      setFieldListHidden(false);
      setTableListHidden(false);
    }
    // 先做静态快速预览
    updatePreview(v);
    try {
      const ed = editorRef.current;
      const model = ed?.getModel();
      if (model) {
        const pairMatches = model.findMatches("\\[[^\\]]+\\]\\s*\\.\\s*@[^\\.()\\s]+", true, false, true, null, true) || [];
        const tableMatches = model.findMatches("\\[[^\\]]+\\]", true, false, true, null, true) || [];
        const fieldMatches = model.findMatches("@[^\\.()\\s]+", true, false, true, null, true) || [];
        const decos = [] as any[];
        pairMatches.forEach((m: any) => decos.push({ range: m.range, options: { inlineClassName: 'fe-token-pill' } }));
        const inPair = (r: any) => pairMatches.some((pm: any) => pm.range.startLineNumber === r.startLineNumber && r.startColumn >= pm.range.startColumn && r.endColumn <= pm.range.endColumn);
        tableMatches.forEach((m: any) => { if (!inPair(m.range)) decos.push({ range: m.range, options: { inlineClassName: 'fe-token-table' } }); });
        fieldMatches.forEach((m: any) => { if (!inPair(m.range)) decos.push({ range: m.range, options: { inlineClassName: 'fe-token-field' } }); });
        tokenDecosRef.current = ed.deltaDecorations(tokenDecosRef.current, decos);
        // 同步最近选择的表与字段，配合联想选择后更新侧栏
        try {
          const pos = ed.getPosition();
          if (pos) {
            const line = model.getLineContent(pos.lineNumber) || "";
            const left = line.slice(0, Math.max(0, (pos.column || 1) - 1));
            const trimmed = left.replace(/\s+/g, "");
            const mTable = trimmed.match(/\[([^\]]+)\](?:\.)?$/);
            if (mTable && mTable[1]) {
              const tName = String(mTable[1]);
              if (schema.some((x) => x.name === tName)) {
                setLookupTable(tName);
              }
            }
            const mField = trimmed.match(/@([^\.()\s,，\]]+)$/);
            if (mField && mField[1]) {
              const disp = String(mField[1]);
              setLastSelectedField({ field: disp, displayName: disp });
              setSelectedFunction('FILTER');
            }
            const lastCh = left.slice(-1);
            const isTypingChar = /[^\s\[\]\(\),，\.]/.test(lastCh) || lastCh === '@' || lastCh === '[';
            const openCountAll = (left.match(/\(/g) || []).length;
            const closeCountAll = (left.match(/\)/g) || []).length;
            const insideArgsGlobal = openCountAll > closeCountAll;
            const now = Date.now();
            const suppressed = suppressFilterOnceRef.current || now < suppressFilterUntilRef.current;
            if (!suppressed && isTypingChar) {
              if (insideArgsGlobal) {
                setTableFilterKey("");
                setFieldFilterKey("");
              } else {
                const idxOpen = left.lastIndexOf('[');
                const idxClose = left.lastIndexOf(']');
                const afterAtCtx = /@[^.()\s,，\]]*$/.test(left) || trimmed.endsWith('@');
                if (idxOpen > idxClose) {
                  const kw = left.slice(idxOpen + 1).trim();
                  setTableFilterKey(kw);
                } else {
                  setTableFilterKey("");
                }
                const mFieldPlain = left.match(/@([^.()\s,，\]]*)$/);
                if (mFieldPlain && mFieldPlain[1]) {
                  const disp = String(mFieldPlain[1]).trim();
                  const exactField = getFieldsForTable(lookupTable).some((f) => (f.name || '').toLowerCase() === disp.toLowerCase());
                  const hasPairExact = lookupTable ? trimmed.endsWith(`[${lookupTable}].@${disp}`) : false;
                  const hasPlainExact = trimmed.endsWith(`@${disp}`);
                  if (exactField && (hasPairExact || hasPlainExact)) {
                    setFieldFilterKey("");
                  } else {
                    setFieldFilterKey(disp);
                  }
                } else {
                  setFieldFilterKey("");
                }
              }
            }

            if (insideArgsGlobal) {
              const leftNoTrailWS = left.replace(/\s+$/, '');
              const lastNs = leftNoTrailWS.slice(-1);
              const lastComma = lastNs === '，' ? ',' : lastNs;
              const col0 = (pos.column || 1) - 1;
              const right = line.slice(Math.max(0, col0));
              const idxOpen = left.lastIndexOf('(');
              const idxCloseRel = right.indexOf(')');
              const idxClose = idxCloseRel >= 0 ? col0 + idxCloseRel : -1;
              const innerSeg = (idxOpen >= 0 && idxClose >= 0) ? line.slice(idxOpen + 1, idxClose) : '';
              const innerHasContent = innerSeg.trim().length > 0;
              if (lastComma === ',') {
                keepArgPickerUntilRef.current = Date.now() + 1500;
                setFieldListHidden(false);
                setTableListHidden(false);
              } else if (!innerHasContent) {
                setFieldListHidden(false);
                setTableListHidden(false);
              } else {
                setFieldListHidden(true);
                setTableListHidden(true);
              }
            }
          }
        } catch {}
      }
    } catch {}
    try {
      if (editorRef.current) {
        const pos = editorRef.current.getPosition();
        const model = editorRef.current.getModel();
        const wordObj = model?.getWordUntilPosition(pos);
        const left2 = (model?.getLineContent(pos.lineNumber) || "").slice(0, Math.max(0, (pos.column || 1) - 1));
        const insideArgsNow = ((left2.match(/\(/g) || []).length) > ((left2.match(/\)/g) || []).length);
        const w = (wordObj?.word || "").toUpperCase();
        const prevCh2 = left2.slice(-1);
        const isWord = /^[A-Z_]+$/.test(w);
        const shouldFnFilter = !insideArgsNow && isWord && /[\s=,(]/.test(prevCh2);
        setFilterFnKeyword(shouldFnFilter ? w : "");
        let selName: string | null = null;
        if (!insideArgsNow && w) {
          const exact = FUNCTIONS.find((f) => f.name === w);
          if (exact) selName = exact.name;
          else {
            const starts = FUNCTIONS.filter((f) => f.name.startsWith(w));
            if (starts.length) {
              selName = starts[0].name;
            }
          }
        }
        if (!insideArgsNow) {
          const line = model?.getLineContent(pos.lineNumber) || "";
          const left = line.slice(0, Math.max(0, (pos.column || 1) - 1));
          const openMatch = left.match(/([A-Za-z_]+)\s*\($/);
          if (openMatch) {
            const cand = openMatch[1].toUpperCase();
            const exact = FUNCTIONS.find((f) => f.name === cand);
            if (exact) selName = exact.name;
          }
          if (!selName && line) {
            const matches = Array.from(line.matchAll(/([A-Za-z_]+)\s*\(/g));
            if (matches.length) {
              const near = matches.reduce((acc: any, m: any) => {
                const start = m.index || 0;
                const end = start + m[0].length;
                if (end <= (pos.column || 1)) return m;
                return acc;
              }, null);
              const c2 = near && near[1] ? String(near[1]).toUpperCase() : "";
              if (c2) {
                const ex2 = FUNCTIONS.find((f) => f.name === c2);
                if (ex2) selName = ex2.name;
              }
            }
          }
        }
        if (selName) setSelectedFunction(selName);
        setActiveTab("edit");
      }
    } catch {}
    // 关键：进行严格 parse 校验并设置 Monaco markers & preview
    validateAndPreview(v);
    if (suppressFilterOnceRef.current) suppressFilterOnceRef.current = false;
  };

  /**
   * 光标处插入文本
   *
   * 参数：
   * - text：要插入的文本
   * - caretOffset：插入后光标相对移动的偏移量（默认移到文本末尾）
   */
  const insertAtCursor = (text: string, caretOffset?: number) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const sel = editor.getSelection();
    const startLine = sel.startLineNumber;
    const startCol = sel.startColumn;
    editor.executeEdits("my-source", [{ range: sel, text, forceMoveMarkers: true }]);
    const offset = typeof caretOffset === "number" ? caretOffset : text.length;
    try {
      editor.setPosition({ lineNumber: startLine, column: startCol + Math.max(0, offset) });
    } catch {}
    editor.focus();
  };

  /**
   * 获取函数分组（按关键字过滤）
   *
   * 返回：
   * - 过滤后的函数分组列表
   */
  const getFilteredGroups = () => {
    const kw = filterFnKeyword.trim().toUpperCase();
    if (!kw) return FUNCTION_GROUPS;
    return FUNCTION_GROUPS.map((g) => ({ category: g.category, items: g.items.filter((n) => n.toUpperCase().startsWith(kw)) })).filter((g) => g.items.length > 0);
  };

  const filteredFields = getFieldsForTable(lookupTable)
    .filter((f) => !fieldFilterKey || ((f.name || '').toLowerCase().includes(fieldFilterKey.toLowerCase())));
  const filteredTables = schema
    .filter((t) => !tableFilterKey || t.name.toLowerCase().includes(tableFilterKey.toLowerCase()));

  return (
    <div className="fe-page">
      <div className="fe-card">
        <div className="fe-header">
          <div className="fe-header-left">
            <div className="fe-title">公式编辑器</div>
          </div>
        </div>

        <div className="fe-editor-section">
          <div className="fe-editor-box">
            <Editor
              defaultLanguage="plaintext"
              value={editorFormula}
              onMount={(editor, monaco) => handleEditorDidMount(editor, monaco)}
              onChange={onEditorChange}
              options={{ minimap: { enabled: false }, fontSize: 14, quickSuggestions: { other: true, comments: true, strings: true }, suggestOnTriggerCharacters: true }}
              className="fe-editor"
            />
          </div>
          <div className="fe-editor-actions">
            {validationError ? <div className="fe-error">{validationError}</div> : null}
            <button onClick={validateFormula} className="fe-btn primary">
              确认
            </button>
          </div>
        </div>

        <div className="fe-tabs">
          <div className="fe-tabs-bar">
            <button onClick={() => setActiveTab("edit")} className={`fe-tab ${activeTab === "edit" ? "active" : ""}`}>
              编辑公式
            </button>
          </div>

          <div className="fe-mt16 fe-tab-panel">
            <div className="fe-function-grid">
              <div className="fe-function-sidebar">
                <div className="fe-function-content">
                  {!fieldListHidden && (
                    <div className="fe-group">
                      {filteredFields.length > 0 && <div className="fe-hint fe-mb6">字段引用</div>}
                      <div className="fe-function-list">
                        {filteredFields.map((f) => (
                          <button key={f.field} onClick={() => insertCurrentField(f.name)} className="fe-function-item">
                            @{f.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {!tableListHidden && (
                    <div className="fe-group">
                      {filteredTables.length > 0 && <div className="fe-hint fe-mb6">整表引用</div>}
                      <div className="fe-function-list">
                          {filteredTables.map((t) => (
                            <button key={t.name} onClick={() => chooseTable(t.name)} className={`fe-function-item ${lookupTable === t.name ? "active" : ""}`}>
                              {t.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  <div className="fe-group">
                    {getFilteredGroups().map((group) => (
                      <div key={group.category} className="fe-group">
                        <div className="fe-hint fe-mb6">{group.category}</div>
                        <div className="fe-function-list">
                          {group.items.map((name) => (
                            <button
                              key={name}
                              onMouseEnter={() => setSelectedFunction(name)}
                              onClick={() => insertFunctionToEditor(name)}
                              className={`fe-function-item ${selectedFunction === name ? "active" : ""}`}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="fe-desc-card">
                {selectedFunction ? (
                  <div>
                    <div className="fe-subtitle">{FUNCTION_DOCS[selectedFunction]?.title || selectedFunction}</div>
                    <div className="fe-hint fe-mb6">{FUNCTION_DOCS[selectedFunction]?.desc || "—"}</div>
                    <div className="fe-hint">使用示例：</div>
                    <div className="fe-examples-list">
                      {(FUNCTION_DOCS[selectedFunction]?.examples || []).map((ex, idx) => (
                        <div key={idx} className="fe-example">
                          {ex}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="fe-hint">鼠标移到左侧函数以查看释义与示例，点击可插入到编辑器。</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
