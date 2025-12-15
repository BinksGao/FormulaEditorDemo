// src/components/FormulaEditorDemo.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { createHyperEngine, computeFormula, parseFormula } from "../lib/formulaEngine";
import "./formula-editor.css";
import {
  SAMPLE_FIELDS,
  FUNCTIONS,
  FUNCTION_DOCS,
  FUNCTION_GROUPS,
  SAMPLE_SCHEMA,
  buildLookupIndexMatch,
  colLetter,
  normalizeFormula,
} from "../utils/formulaUtils";

export default function FormulaEditorDemo() {
  const [inputText, setInputText] = useState("");
  const [detectedIntent, setDetectedIntent] = useState<string | null>(null);
  const [generatedFormula, setGeneratedFormula] = useState("");
  const [editorFormula, setEditorFormula] = useState("");
  const hfRef = useRef<any | null>(null);
  const [preview, setPreview] = useState<string | number | null>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "ai">("edit");
  const [fields] = useState(SAMPLE_FIELDS);
  const [schema] = useState(SAMPLE_SCHEMA);
  const [lookupTable, setLookupTable] = useState<string>(SAMPLE_SCHEMA[0]?.name || "");
  const getFieldsForTable = useCallback((t: string) => schema.find((x) => x.name === t)?.fields || [], [schema]);
  const [lookupKeyField, setLookupKeyField] = useState<string>(getFieldsForTable(lookupTable)[0]?.field || "");
  const [lookupValueField, setLookupValueField] = useState<string>(getFieldsForTable(lookupTable)[1]?.field || "");
  const [tableListHidden, setTableListHidden] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>("");
  const [lookupKeyExpr, setLookupKeyExpr] = useState<string>("@字段1");
  const [wrapIfna, setWrapIfna] = useState<boolean>(true);
  const [ifnaDefault, setIfnaDefault] = useState<string>('"未找到"');
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
  const prevLeftRef = useRef<string>("");

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

  // 初始化编辑器：保存实例引用，注册补全/悬浮提示，并设置内联高亮
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

  // --- helper: set Monaco markers ---
  // 解析错误标记：将语法错误映射为 Monaco 的 markers，便于定位
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

  // validate + preview（核心）
  // 校验与预览：将自定义公式标准化，交给 HyperFormula 进行解析与计算
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

  // --- existing helpers (保留你原有逻辑) ---
  // 函数签名缓存：统计各内置函数的必选/可选/可变参数，用于静态校验
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

  // 转换显示名到代码名：
  // - [表].@字段 或 @字段/裸字段 根据上下文转换为 [tableFieldName.field]
  // - 表显示名映射为 schema.fieldName；字段显示名映射为 schema.fields[].field
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

  // 确认按钮行为：仅输出转换后的公式字符串到控制台
  const validateFormula = () => {
    const code = (editorFormula || "").trim();
    const transformed = transformToFieldKeys(code);
    const noSpaces = transformed.replace(/ +/g, "");
    console.log(noSpaces);
  };

  const FORMULA_TEMPLATES: Record<string, string> = {
    text_concat: "=CONCAT({field1}, {field2})",
    date_compare: "=IF({left} {operator} {right}, TRUE, FALSE)",
    add_fields: "={left} + {right}",
    order_timeout: '=IF(DATEDIF({order_date}, TODAY(), "H")>24, "超时", "正常")',
  };

  // 简易意图识别：根据文本关键词匹配示例模板
  const detectIntent = (s: string) => {
    const t = s.toLowerCase();
    if (t.includes("拼接") || t.includes("合并") || t.includes("连接")) return "text_concat";
    if (t.includes("判断") && (t.includes("早于") || t.includes("晚于") || t.includes("大于") || t.includes("小于"))) return "date_compare";
    if (t.includes("相加") || t.includes("加上") || t.includes("求和")) return "add_fields";
    if (t.includes("超时") || t.includes("24小时") || t.includes("未发货")) return "order_timeout";
    return "unknown";
  };

  // 示例参数提取：从自然语言中提取字段占位符
  const extractParams = (s: string) => {
    const result: any = {};
    if (s.includes("今天") || s.includes("当前日期")) {
      result.left = "TODAY()";
      result.right = "TODAY()";
    }
    if (s.includes("早于")) result.operator = "<";
    if (s.includes("晚于")) result.operator = ">";
    SAMPLE_FIELDS.forEach((f) => {
      if (s.includes(f.name)) {
        if (!result.field1) result.field1 = `@${f.name}`;
        else if (!result.field2) result.field2 = `@${f.name}`;
      }
    });
    if (s.includes("下单时间") || s.includes("订单时间")) {
      result.order_date = "[下单时间]";
    }
    return result;
  };

  // 模板填充：将识别出的意图与参数替换为公式示例
  const fillTemplate = (intent: string, params: Record<string, string>) => {
    const template = FORMULA_TEMPLATES[intent];
    if (!template) return "";
    let formula = template;
    Object.keys(params).forEach((k) => {
      const re = new RegExp(`\\{${k}\\}`, "g");
      formula = formula.replace(re, params[k]);
    });
    formula = formula.replace(/\{field1\}/g, params.field1 || "@字段1");
    formula = formula.replace(/\{field2\}/g, params.field2 || "@字段2");
    formula = formula.replace(/\{left\}/g, params.left || "@左字段");
    formula = formula.replace(/\{right\}/g, params.right || "@右字段");
    formula = formula.replace(/\{operator\}/g, params.operator || "=");
    return formula;
  };

  // 生成示例公式：结合意图识别与参数抽取得到示例公式
  const generateFormulaByRules = () => {
    const intent = detectIntent(inputText);
    setDetectedIntent(intent);
    const params = extractParams(inputText);
    const formula = fillTemplate(intent, params);
    setGeneratedFormula(formula);
  };

  // 插入文本：将字符串写入当前选区并聚焦编辑器
  const insertTextToEditor = (text: string) => {
    suppressFilterOnceRef.current = true;
    suppressFilterUntilRef.current = Date.now() + 300;
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const sel = editor.getSelection();
    const displayText = text.startsWith("=") ? text.slice(1) : text;
    editor.executeEdits("insert-text", [{ range: sel, text: displayText, forceMoveMarkers: true }]);
    editor.focus();
  };

  // 采纳示例：将右侧生成的公式写入编辑器
  const insertFormulaToEditor = () => {
    if (!generatedFormula) return;
    suppressFilterOnceRef.current = true;
    suppressFilterUntilRef.current = Date.now() + 2000;
    insertTextToEditor(generatedFormula);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedFormula);
    } catch (e) {}
  };

  // 示例填充：快速将推荐指令写入输入框
  const setExample = (t: string) => {
    setInputText(t);
  };

  // 插入函数：与最近选择的字段联动，避免重复的 '.'，并将光标定位到括号内
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

  // 插入字段：在参数上下文中智能补逗号；若左侧已有 [表]. 或 [表] 前缀则直接拼接
  const insertCurrentField = (displayName: string) => {
    // 旧参数：字段标识 name
    // 新参数：显示名 displayName
    setLastSelectedField({ field: displayName, displayName });
    suppressFilterOnceRef.current = true;
    suppressFilterUntilRef.current = Date.now() + 2000;
    setFieldFilterKey("");
    setTableFilterKey("");
    // 旧逻辑：在未选择数据表时也带出数据表前缀
    // const effectiveTable = lookupTable || (schema[0]?.name || "");
    // const prefix = effectiveTable ? `[${effectiveTable}].` : "";
    // insertAtCursor(`${prefix}@${displayName}`);
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
        let needComma = insideArgs && prevChar !== '(' && prevChar !== ',';
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

  // 选择数据表：插入 [表]. 前缀（不自动加逗号），并更新当前选中表
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
        const needComma = insideArgs && prevChar !== '(' && prevChar !== ',';
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

  useEffect(() => {
    const fs = getFieldsForTable(lookupTable);
    if (!lookupTable || fs.length === 0) {
      setLookupKeyField("");
      setLookupValueField("");
    } else {
      setLookupKeyField(fs[0]?.field || "");
      setLookupValueField(fs[1]?.field || "");
    }
  }, [lookupTable, getFieldsForTable]);

  // 交叉查找示例：组合 IFNA 包裹的查找表达式
  const composeCrossLookup = () => {
    const fs = getFieldsForTable(lookupTable);
    const base = buildLookupIndexMatch(lookupTable, fs, lookupKeyField, lookupKeyExpr, lookupValueField);
    if (!base) return;
    const f = wrapIfna ? `=IFNA(${base.slice(1)}, ${ifnaDefault})` : base;
    const existing = (generatedFormula || "").trim();
    let next = f;
    if (existing) {
      const eBody = existing.startsWith("=") ? existing.slice(1) : existing;
      const fBody = f.startsWith("=") ? f.slice(1) : f;
      next = `=CONCAT(${eBody}, ${fBody})`;
    }
    setGeneratedFormula(next);
    setActiveTab("ai");
  };

  // 编辑器变更：更新公式、预览、样式装饰与当前函数选择，并进行解析校验
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
              const col0 = (pos.column || 1) - 1;
              const right = line.slice(Math.max(0, col0));
              const idxOpen = left.lastIndexOf('(');
              const idxCloseRel = right.indexOf(')');
              const idxClose = idxCloseRel >= 0 ? col0 + idxCloseRel : -1;
              const innerSeg = (idxOpen >= 0 && idxClose >= 0) ? line.slice(idxOpen + 1, idxClose) : '';
              const innerHasContent = innerSeg.trim().length > 0;
              if (lastNs === ',') {
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
    try {
      const ed2 = editorRef.current;
      const model2 = ed2?.getModel();
      const pos2 = ed2?.getPosition();
      const leftSnap = (model2?.getLineContent(pos2?.lineNumber || 1) || "").slice(0, Math.max(0, ((pos2?.column || 1) - 1)));
      prevLeftRef.current = leftSnap;
    } catch {}
  };

  // 光标插入：在当前光标写入文本，并支持将光标移动到括号内部
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
