import { getPortfolio } from "./services/zerion.js";

const data = await getPortfolio("0x9dCFF04fafC8e7cAC8c0A70DB61f2E33166dDFB6");
console.log(data);