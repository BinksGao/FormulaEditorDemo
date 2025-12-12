import { HyperFormula } from "hyperformula";

const TEMP_SHEET_NAME = "__TEMP__HF__";
let hfSingleton: ReturnType<typeof HyperFormula.buildEmpty> | null = null;

export function createHyperEngine() {
  if (hfSingleton) return hfSingleton;
  const hf = HyperFormula.buildEmpty({ licenseKey: "gpl-v3" });
  // ensure temp sheet exists
  try {
    // addSheet with name not always supported depending on API, so check addSheet return
    try {
      const idOrName = hf.addSheet(TEMP_SHEET_NAME);
      // some versions return sheetId number, some return name - ignore
    } catch {
      // fallback: try getSheetId to see if exists
      try {
        const id = (hf as any).getSheetId && (hf as any).getSheetId(TEMP_SHEET_NAME);
        if (typeof id === "undefined") {
          // create unnamed sheet
          hf.addSheet();
        }
      } catch {}
    }
  } catch (e) {
    // ignore
  }
  hfSingleton = hf;
  return hfSingleton;
}

/**
 * 在持久 temp sheet 的 A1 单元格中计算公式并返回值。
 * 不删除 sheet，计算后清空单元格内容以便复用。
 */
export function computeFormula(hf: HyperFormula, formula: string) {
  try {
    // 获取 sheetId，如果 hf 提供 getSheetId 则使用指定名称
    let sheetId: number = 0;
    try {
      const getSheetIdFn = (hf as any).getSheetId;
      if (typeof getSheetIdFn === "function") {
        const sid = (hf as any).getSheetId(TEMP_SHEET_NAME);
        if (typeof sid === "number") sheetId = sid;
        else sheetId = 0;
      } else {
        sheetId = 0;
      }
    } catch {
      sheetId = 0;
    }

    // 写入 A1
    hf.setCellContents({ sheet: sheetId, col: 0, row: 0 }, formula);
    const val = hf.getCellValue({ sheet: sheetId, col: 0, row: 0 });
    // 清空（若 API 支持）
    try {
      hf.setCellContents({ sheet: sheetId, col: 0, row: 0 }, "");
    } catch {}
    return { ok: true, value: val };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * parseFormula：调用 HyperFormula 的解析接口以获取语法错误信息
 * 返回：{ ok: boolean, errors: Array< { message: string, location?:number, start?:number, end?:number } > }
 */
export function parseFormula(hf: HyperFormula, formula: string) {
  try {
    const instanceParse: any = (hf as any).parseFormula;
    const staticParse: any = (HyperFormula as any).parseFormula;
    let parsed: any = null;

    if (typeof instanceParse === "function") {
      parsed = instanceParse.call(hf, formula);
    } else if (typeof staticParse === "function") {
      parsed = staticParse.call(HyperFormula, formula);
    } else {
      // fallback: try compute to detect gross errors (弱校验)
      const res = computeFormula(hf, formula);
      if (!res.ok) {
        return { ok: false, errors: [{ message: res.error || "计算错误" }] };
      }
      return { ok: true, errors: [] };
    }

    const errors = parsed && parsed.errors ? parsed.errors : [];
    // unify errors to { message, location?, start?, end? }
    const unified = (errors || []).map((e: any) => {
      // hyperformula error shapes vary; pick common fields
      const obj: any = { message: e.message || String(e) };
      if (typeof e.location !== "undefined") obj.location = e.location;
      if (typeof e.start !== "undefined") obj.start = e.start;
      if (typeof e.end !== "undefined") obj.end = e.end;
      if (typeof e.offset !== "undefined") obj.location = e.offset;
      return obj;
    });
    return { ok: unified.length === 0, errors: unified };
  } catch (e: any) {
    return { ok: false, errors: [{ message: e?.message || String(e) }] };
  }
}
