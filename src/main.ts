import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./style.css";
import { Game } from "./game";

const canvas = document.querySelector<HTMLCanvasElement>("#view");
const loaderText = document.querySelector("#loader-text");
if (!canvas) throw new Error("Missing canvas");

const game = new Game(canvas);
game
  .load((text) => {
    if (loaderText) loaderText.textContent = text;
  })
  .then(() => {
    document.getElementById("loader")?.classList.add("hide");
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "The terrace could not be lit.";
    if (loaderText) loaderText.textContent = message;
  });
