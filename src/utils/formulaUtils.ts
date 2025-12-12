export const SAMPLE_FIELDS = [
  { id: "col1", name: "姓名", type: "text" },
  { id: "col2", name: "入职日期", type: "date" },
  { id: "col3", name: "工资", type: "number" },
  { id: "col4", name: "状态", type: "single_select" },
];

export const FUNCTIONS = [
  { name: "SUM", params: "...values" },
  { name: "AVERAGE", params: "...values" },
  { name: "MAX", params: "...values" },
  { name: "MIN", params: "...values" },
  { name: "FILTER", params: "range, condition?" },
  { name: "IF", params: "condition, trueValue, falseValue" },
  { name: "AND", params: "cond1, cond2" },
  { name: "OR", params: "cond1, cond2" },
  { name: "NOT", params: "condition" },
  { name: "XOR", params: "cond1, cond2" },
  { name: "IFS", params: "cond1, value1, cond2, value2, ..." },
  { name: "SWITCH", params: "expr, val1, res1, val2, res2, default?" },
  { name: "IFERROR", params: "value, value_if_error" },
  { name: "IFNA", params: "value, value_if_na" },
  { name: "VLOOKUP", params: "lookup, range, colIndex, exact" },
  { name: "INDEX", params: "range, row" },
  { name: "MATCH", params: "lookup, range, 0" },
  { name: "COUNTIF", params: "range, criteria" },
  { name: "COUNTIFS", params: "range1, criteria1, range2, criteria2" },
  { name: "TODAY", params: "" },
  { name: "NOW", params: "" },
  { name: "DATE", params: "year, month, day" },
  { name: "DATEDIF", params: "startDate, endDate, unit" },
  { name: "DAY", params: "date" },
  { name: "DAYS", params: "endDate, startDate" },
  { name: "EDATE", params: "startDate, months" },
  { name: "EOMONTH", params: "startDate, months" },
  { name: "HOUR", params: "time" },
  { name: "MINUTE", params: "time" },
  { name: "MONTH", params: "date" },
  { name: "NETWORKDAYS", params: "startDate, endDate, holidays?" },
  { name: "SECOND", params: "time" },
  { name: "WEEKDAY", params: "date, type?" },
  { name: "WEEKNUM", params: "date, type?" },
  { name: "WORKDAY", params: "startDate, days, holidays?" },
  { name: "YEAR", params: "date" },
  { name: "CONCAT", params: "text1, text2" },
  { name: "CONTAINS", params: "text, sub" },
  { name: "CONTAINSALL", params: "text, sub1, sub2" },
  { name: "CONTAINSANY", params: "text, sub1, sub2" },
  { name: "LEFT", params: "text, count" },
  { name: "RIGHT", params: "text, count" },
  { name: "MID", params: "text, start, count" },
  { name: "UPPER", params: "text" },
  { name: "LOWER", params: "text" },
  { name: "SUBSTITUTE", params: "text, old, new" },
  { name: "REPLACE", params: "text, start, count, newText" },
  { name: "TRIM", params: "text" },
  { name: "VALUE", params: "text" },
  { name: "TEXT", params: "value, format" },
  { name: "COUNT", params: "range" },
  { name: "COUNTA", params: "range" },
  { name: "COUNTBLANK", params: "range" },
  { name: "SUMIF", params: "range, criteria, sumRange" },
  { name: "SUMIFS", params: "sumRange, range1, criteria1, range2, criteria2" },
  { name: "AVERAGEIF", params: "range, criteria, avgRange?" },
  { name: "AVERAGEIFS", params: "avgRange, range1, criteria1, range2, criteria2" },
  { name: "ABS", params: "number" },
  { name: "ROUND", params: "number, digits" },
  { name: "ROUNDUP", params: "number, digits" },
  { name: "ROUNDDOWN", params: "number, digits" },
  { name: "CEILING", params: "number, significance" },
  { name: "FLOOR", params: "number, significance" },
  { name: "POWER", params: "number, power" },
  { name: "SQRT", params: "number" },
  { name: "SUMPRODUCT", params: "array1, array2" },
];

export const FUNCTION_DOCS: Record<string, { title: string; desc: string; examples: string[] }> = {
  SUM: { title: "SUM(…)", desc: "对一组数值进行求和", examples: ["=SUM(1,2,3)", "=SUM(10,@工资)"] },
  AVERAGE: { title: "AVERAGE(…)", desc: "对一组数值求平均值", examples: ["=AVERAGE(1,2,3)", "=AVERAGE(B2:B8)"] },
  MAX: { title: "MAX(…)", desc: "返回一组数中的最大值", examples: ["=MAX(1,2,3)", "=MAX(C1:C20)"] },
  MIN: { title: "MIN(…)", desc: "返回一组数中的最小值", examples: ["=MIN(1,2,3)", "=MIN(D3:D15)"] },
  IF: { title: "IF(条件, 为真值, 为假值)", desc: "根据条件返回不同结果", examples: ['=IF(@入职日期 < TODAY(), "早于", "未早于")', '=IF(LEN(@姓名)>2, "有效", "无效")'] },
  AND: { title: "AND(条件1, 条件2, …)", desc: "同时满足所有条件时返回 TRUE", examples: ["=AND(B1>80, C1>80)"] },
  OR: { title: "OR(条件1, 条件2, …)", desc: "任意条件满足时返回 TRUE", examples: ["=OR(D1>90, E1>90)"] },
  NOT: { title: "NOT(条件)", desc: "逻辑非，条件为 TRUE 时返回 FALSE，反之亦然", examples: ["=NOT(B1>0)"] },
  XOR: { title: "XOR(条件1, 条件2, …)", desc: "逻辑异或，奇数个条件为 TRUE 时返回 TRUE", examples: ["=XOR(B1>0, C1>0)"] },
  IFS: { title: "IFS(条件1, 值1, 条件2, 值2, …)", desc: "按顺序判断多个条件，返回第一个满足条件的值", examples: ['=IFS(B1>=90, "优秀", B1>=60, "及格", TRUE, "不及格")'] },
  SWITCH: { title: "SWITCH(表达式, 值1, 结果1, 值2, 结果2, 默认?)", desc: "按匹配的值返回对应结果，否则返回默认值", examples: ['=SWITCH(@状态, "已发货", 1, "待发货", 0, -1)'] },
  IFERROR: { title: "IFERROR(值, 出错时的值)", desc: "若表达式计算错误则返回兜底值，否则返回表达式值", examples: ["=IFERROR(1/0, 0)"] },
  IFNA: { title: "IFNA(值, NA时的值)", desc: "若表达式返回 #N/A 则返回兜底值，否则返回表达式值", examples: ['=IFNA(VLOOKUP("张三", A2:C10, 3, FALSE), "未找到")'] },
  VLOOKUP: { title: "VLOOKUP(查找值, 查找表, 列序号, 精确)", desc: "垂直查找并返回匹配行的指定列", examples: ['=VLOOKUP("张三", A2:C10, 3, FALSE)'] },
  INDEX: { title: "INDEX(区域, 行号)", desc: "返回区域中指定行的值", examples: ["=INDEX(C2:C10, 3)"] },
  MATCH: { title: "MATCH(查找值, 区域, 匹配类型)", desc: "返回查找值在区域中的位置", examples: ['=MATCH("李四", A2:A10, 0)'] },
  COUNTIF: { title: "COUNTIF(区域, 条件)", desc: "统计满足条件的单元格数量", examples: ['=COUNTIF(F2:F50, ">100")'] },
  COUNTIFS: { title: "COUNTIFS(区域1, 条件1, 区域2, 条件2)", desc: "统计同时满足多条件的单元格数量", examples: ['=COUNTIFS(G2:G50, "男", H2:H50, ">25")'] },
  TODAY: { title: "TODAY()", desc: "返回今天日期", examples: ["=IF(@入职日期 < TODAY(), TRUE, FALSE)"] },
  NOW: { title: "NOW()", desc: "返回当前日期和时间", examples: ["=NOW()"] },
  DATE: { title: "DATE(年, 月, 日)", desc: "将代表年、月、日的数字转换为日期", examples: ["=DATE(2000,1,1)"] },
  DATEDIF: { title: "DATEDIF(开始日期, 结束日期, 单位)", desc: "计算两个日期之间的差值（支持 Y/M/D/H 等单位）", examples: ['=DATEDIF(A1, B1, "Y")', '=DATEDIF(A1, TODAY(), "H")'] },
  DAY: { title: "DAY(日期值)", desc: "以数字格式返回特定日期的日", examples: ['=DAY("2000-01-03")'] },
  DAYS: { title: "DAYS(结束日期, 起始日期)", desc: "返回起始日期与结束日期之间的天数", examples: ['=DAYS("2000-01-08", "2000-01-01")'] },
  EDATE: { title: "EDATE(开始日期, 月数)", desc: "返回输入日期特定月数之前或者之后的日期", examples: ['=EDATE("2011/01/31", 1)', '=EDATE("2011/01/01", -1)'] },
  EOMONTH: { title: "EOMONTH(开始日期, 月数)", desc: "返回与开始日期相隔数月的某个月份最后一天的日期", examples: ['=EOMONTH("2011/01/01", 1)'] },
  HOUR: { title: "HOUR(时间)", desc: "以数字格式返回特定时间的小时部分", examples: ['=HOUR("11:40:59")'] },
  MINUTE: { title: "MINUTE(时间)", desc: "以数字格式返回特定时间的分钟部分", examples: ['=MINUTE("11:40:59")'] },
  MONTH: { title: "MONTH(日期值)", desc: "以数字格式返回特定日期对应的月份", examples: ['=MONTH("2000-12-01")'] },
  NETWORKDAYS: { title: "NETWORKDAYS(起始日期, 结束日期, [节假日])", desc: "返回起始日期和结束日期之间的净工作日天数", examples: ['=NETWORKDAYS("2000-01-01", "2000-01-12")'] },
  SECOND: { title: "SECOND(时间)", desc: "以数字格式返回特定时间的秒钟部分", examples: ['=SECOND("11:40:59")'] },
  WEEKDAY: { title: "WEEKDAY(日期值, [类型])", desc: "返回目标日期在当周的第几天，结果以数字形式显示", examples: ['=WEEKDAY("2000-01-01")'] },
  WEEKNUM: { title: "WEEKNUM(日期, [类型])", desc: "返回目标日期在当前年份的第几周", examples: ['=WEEKNUM("2000-01-01")'] },
  WORKDAY: { title: "WORKDAY(起始日期, 天数, [节假日])", desc: "指定起始日期和所需要的工作日天数，返回结束日期", examples: ['=WORKDAY("2000/01/01",7)'] },
  YEAR: { title: "YEAR(日期值)", desc: "以数字格式返回给定日期所指定的年份", examples: ['=YEAR("2000-01-01")'] },
  LEN: { title: "LEN(文本)", desc: "返回文本长度", examples: ["=LEN(@姓名)"] },
  CONCAT: { title: "CONCAT(文本1, 文本2)", desc: "拼接多个文本", examples: ['=CONCAT(@姓名, " - ", @状态)'] },
  CONTAINS: { title: "CONTAINS(文本, 子串)", desc: "判断文本是否包含指定子串", examples: ['=CONTAINS("北京上海", "上海")'] },
  CONTAINSALL: { title: "CONTAINSALL(文本, 子串1, 子串2, …)", desc: "判断文本是否同时包含所有给定子串", examples: ['=CONTAINSALL("杭州北京上海", "北京", "上海")'] },
  CONTAINSANY: { title: "CONTAINSANY(文本, 子串1, 子串2, …)", desc: "判断文本是否至少包含任一给定子串", examples: ['=CONTAINSANY("广州深圳", "北京", "深圳")'] },
  LEFT: { title: "LEFT(文本, 个数)", desc: "从左侧截取指定长度", examples: ["=LEFT(E1, 3)"] },
  RIGHT: { title: "RIGHT(文本, 个数)", desc: "从右侧截取指定长度", examples: ["=RIGHT(E1, 2)"] },
  MID: { title: "MID(文本, 起始位置, 个数)", desc: "从文本中间截取指定长度", examples: ["=MID(E1, 2, 3)"] },
  UPPER: { title: "UPPER(文本)", desc: "转换为大写", examples: ["=UPPER(@姓名)"] },
  LOWER: { title: "LOWER(文本)", desc: "转换为小写", examples: ["=LOWER(@姓名)"] },
  SUBSTITUTE: { title: "SUBSTITUTE(文本, 旧, 新)", desc: "替换文本中的匹配内容", examples: ['=SUBSTITUTE(E1, "北京", "上海")'] },
  REPLACE: { title: "REPLACE(文本, 起始位置, 个数, 新文本)", desc: "按位置替换指定长度的文本", examples: ['=REPLACE(E1, 2, 3, "***")'] },
  TRIM: { title: "TRIM(文本)", desc: "去除文本中的多余空格", examples: ["=TRIM(H1)"] },
  VALUE: { title: "VALUE(文本)", desc: "将文本解析为数值", examples: ['=VALUE("123")'] },
  TEXT: { title: "TEXT(值, 格式)", desc: "按格式将数值/日期转为文本", examples: ['=TEXT(TODAY(), "yyyy-MM-dd")'] },
  COUNT: { title: "COUNT(区域)", desc: "统计区域内数字单元格的数量", examples: ["=COUNT(G2:G30)"] },
  COUNTA: { title: "COUNTA(区域)", desc: "统计区域内非空单元格的数量", examples: ["=COUNTA(H2:H30)"] },
  COUNTBLANK: { title: "COUNTBLANK(区域)", desc: "统计区域内空白单元格的数量", examples: ["=COUNTBLANK(H2:H30)"] },
  SUMIF: { title: "SUMIF(区域, 条件, 求和区域)", desc: "按单条件对满足的项求和", examples: ['=SUMIF(I2:I50, "A类", J2:J50)'] },
  SUMIFS: { title: "SUMIFS(求和区域, 区域1, 条件1, 区域2, 条件2)", desc: "按多条件对满足的项求和", examples: ['=SUMIFS(K2:K50, L2:L50, "上海", M2:M50, "2025")'] },
  AVERAGEIF: { title: "AVERAGEIF(区域, 条件, 平均区域?)", desc: "按单条件计算平均值", examples: ['=AVERAGEIF(A2:A50, ">=80", B2:B50)'] },
  AVERAGEIFS: { title: "AVERAGEIFS(平均区域, 区域1, 条件1, 区域2, 条件2)", desc: "按多条件计算平均值", examples: ['=AVERAGEIFS(B2:B50, A2:A50, "男", C2:C50, ">=25")'] },
  ABS: { title: "ABS(数值)", desc: "返回绝对值", examples: ["=ABS(-3)"] },
  ROUND: { title: "ROUND(数值, 位数)", desc: "按位数四舍五入", examples: ["=ROUND(3.1415, 2)"] },
  ROUNDUP: { title: "ROUNDUP(数值, 位数)", desc: "按位数向上取整", examples: ["=ROUNDUP(3.1415, 2)"] },
  ROUNDDOWN: { title: "ROUNDDOWN(数值, 位数)", desc: "按位数向下取整", examples: ["=ROUNDDOWN(3.1415, 2)"] },
  CEILING: { title: "CEILING(数值, 基数)", desc: "向上取至最接近的倍数", examples: ["=CEILING(7, 5)"] },
  FLOOR: { title: "FLOOR(数值, 基数)", desc: "向下取至最接近的倍数", examples: ["=FLOOR(7, 5)"] },
  POWER: { title: "POWER(底数, 幂)", desc: "乘方运算", examples: ["=POWER(2, 8)"] },
  SQRT: { title: "SQRT(数值)", desc: "平方根", examples: ["=SQRT(16)"] },
  SUMPRODUCT: { title: "SUMPRODUCT(数组1, 数组2)", desc: "数组对应项乘积之和", examples: ["=SUMPRODUCT(A1:A3, B1:B3)"] },
};

export const FUNCTION_GROUPS: { category: string; items: string[] }[] = [
  { category: "基础运算", items: ["SUM", "AVERAGE", "MAX", "MIN"] },
  { category: "逻辑判断", items: ["IF", "AND", "OR", "NOT", "XOR", "IFS", "SWITCH", "IFERROR", "IFNA"] },
  { category: "查找引用", items: ["VLOOKUP", "INDEX", "MATCH"] },
  { category: "数据处理", items: ["FILTER", "COUNTIF", "COUNTIFS"] },
  { category: "日期时间", items: ["TODAY", "NOW", "DATE", "DAY", "DAYS", "EDATE", "EOMONTH", "HOUR", "MINUTE", "MONTH", "SECOND", "WEEKDAY", "WEEKNUM", "WORKDAY", "YEAR", "DATEDIF", "NETWORKDAYS"] },
  { category: "文本处理", items: ["CONCAT", "CONTAINS", "CONTAINSALL", "CONTAINSANY", "LEFT", "RIGHT", "MID", "UPPER", "LOWER", "SUBSTITUTE", "REPLACE", "TRIM", "VALUE", "TEXT"] },
  {
    category: "统计分析",
    items: ["COUNT", "COUNTA", "COUNTBLANK", "SUMIF", "SUMIFS", "AVERAGEIF", "AVERAGEIFS", "SUMPRODUCT", "ABS", "ROUND", "ROUNDUP", "ROUNDDOWN", "CEILING", "FLOOR", "POWER", "SQRT"],
  },
];

export type TableSchemaField = { name: string; field: string };
// 表结构定义：
// - name 为显示名（供编辑器显示）
// - fieldName 为代码名（生成公式时用于表标识）
// - fields[].name 为字段显示名，fields[].field 为字段代码名
export type TableSchema = { name: string; fields: TableSchemaField[], fieldName: string };
export const SAMPLE_SCHEMA: TableSchema[] = [
  {
    name: "出库通知单",
    fieldName: 'outStock',
    fields: [
      { name: "编号", field: "id" },
      { name: "姓名", field: "name" },
      { name: "等级", field: "level" },
    ],
  },
  {
    name: "交接单",
    fieldName: 'handOver',
    fields: [
      { name: "编号", field: "id" },
      { name: "客户编号", field: "customerId" },
      { name: "金额", field: "amount" },
      { name: "日期", field: "date" },
    ],
  },
];

export const colLetter = (idx: number) => {
  let n = idx;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
};

export function buildLookupIndexMatch(tableName: string, fields: TableSchemaField[], keyField: string, keyExpr: string, valueField: string) {
  const keyIdx = fields.findIndex((f) => f.field === keyField);
  const valIdx = fields.findIndex((f) => f.field === valueField);
  if (keyIdx < 0 || valIdx < 0) return "";
  const kc = colLetter(keyIdx);
  const vc = colLetter(valIdx);
  return `=INDEX('${tableName}'!${vc}:${vc}, MATCH(${keyExpr}, '${tableName}'!${kc}:${kc}, 0))`;
}

/**
 * resolveAtFieldToRange
 * 把 @字段 映射为 当前表 的整列引用（'Current'!C:C）
 * currentTableName 参数默认 'Sheet1'，可在调用方传入真实表名
 */
export function resolveAtFieldToRange(fieldDisplayName: string, currentTableName = "Sheet1") {
  const raw = String(fieldDisplayName || "").replace(/^@/, "");
  // find index in SAMPLE_FIELDS (name 或 field)
  const idx = SAMPLE_FIELDS.findIndex((f: any) => f.name === raw || f.id === raw || f.field === raw);
  if (idx < 0) {
    return `'${currentTableName}'!A:Z`;
  }
  const c = colLetter(idx);
  return `'${currentTableName}'!${c}:${c}`;
}

/**
 * normalizeFormula(raw, schema?, currentTableName?)
 * - 将自定义语法转换为 HyperFormula / Excel 可识别的引用
 * - 支持 [Table].Method(...) / [Table].Field / @Field
 */
export function normalizeFormula(raw: string, schema: TableSchema[] = SAMPLE_SCHEMA, currentTableName = "Sheet1") {
  if (!raw) return raw;
  let out = String(raw);

  // 0) 链式： [Table].@field.METHOD(args...)
  // 将自定义链式语法转换为 HyperFormula 的范围表达式
  // 旧逻辑：仅匹配 ASCII 字段标识
  // out = out.replace(/\[([^\]]+)\]\s*\.\s*@([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)/g, (_m, tbl, field, method, args) => {
  //   const table = String(tbl);
  //   const fields = (schema.find((x) => x.name === table)?.fields || []) as TableSchemaField[];
  //   const idx = fields.findIndex((f) => f.field === field || f.name === field);
  //   const c = idx >= 0 ? colLetter(idx) : "A";
  //   const a = String(args || "").trim();
  //   const m = String(method || "").toUpperCase();
  //   return `${m}('${table}'!${c}:${c}${a ? ", " + a : ""})`;
  // });
  out = out.replace(/\[([^\]]+)\]\s*\.\s*@([^\.()\s]+)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)/g, (_m, tbl, field, method, args) => {
    const table = String(tbl);
    const fields = (schema.find((x) => x.name === table)?.fields || []) as TableSchemaField[];
    const idx = fields.findIndex((f) => f.field === field || f.name === field);
    const c = idx >= 0 ? colLetter(idx) : "A";
    const a = String(args || "").trim();
    const m = String(method || "").toUpperCase();
    return `${m}('${table}'!${c}:${c}${a ? ", " + a : ""})`;
  });

  // 1) 方法调用： [Table].METHOD(args...)
  // 将表作为首参数范围传入函数
  out = out.replace(/\[([^\]]+)\]\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)/g, (_m, tbl, method, args) => {
    const table = String(tbl);
    const m = String(method).toUpperCase();
    const a = String(args || "").trim();
    if (m === "FILTER") {
      return `FILTER('${table}'!A:Z${a ? ", " + a : ""})`;
    }
    // 默认把表作为首参范围
    return `${m}('${table}'!A:Z${a ? ", " + a : ""})`;
  });

  // 2) 表字段引用： [Table].Field -> 'Table'!C:C
  // 基于 schema 的字段索引计算列字母
  out = out.replace(/\[([^\]]+)\]\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\b(?!\s*\()/g, (_m, tbl, prop) => {
    const table = String(tbl);
    const fields = (schema.find((x) => x.name === table)?.fields || []) as TableSchemaField[];
    const idx = fields.findIndex((f) => f.field === prop || f.name === prop);
    if (idx < 0) {
      return `'${table}'!A:Z`;
    }
    const c = colLetter(idx);
    return `'${table}'!${c}:${c}`;
  });

  // 2.5) 链式： @field.METHOD(args...)
  // 当前表字段作为范围参与函数调用
  // 旧逻辑：仅匹配 ASCII 字段标识
  // out = out.replace(/@([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)/g, (_m, field, method, args) => {
  //   const range = resolveAtFieldToRange(field, currentTableName);
  //   const a = String(args || "").trim();
  //   const m = String(method || "").toUpperCase();
  //   return `${m}(${range}${a ? ", " + a : ""})`;
  // });
  out = out.replace(/@([^\.()\s]+)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)/g, (_m, field, method, args) => {
    const range = resolveAtFieldToRange(field, currentTableName);
    const a = String(args || "").trim();
    const m = String(method || "").toUpperCase();
    return `${m}(${range}${a ? ", " + a : ""})`;
  });

  // 3) @字段 -> currentTable 的列范围
  // 将 @字段 映射到当前表的整列范围
  out = out.replace(/@([^\s,()]+)/g, (_m, fieldName) => {
    return resolveAtFieldToRange(fieldName, currentTableName);
  });

  return out;
}
