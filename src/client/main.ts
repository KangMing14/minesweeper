import "./style.css";
import { CORE_VERSION } from "../core";

const app = document.querySelector<HTMLDivElement>("#app");
if (app === null) {
  throw new Error("Missing #app element in index.html");
}
app.textContent = `Minesweeper core v${CORE_VERSION}`;
