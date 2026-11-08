import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TopicsChart, { wrapLabel } from "./TopicsChart";

afterEach(cleanup);

function labelLines() {
  return Array.from(document.querySelectorAll("text")).map((text) =>
    Array.from(text.querySelectorAll(".topics-chart__label")).map((line) => line.textContent),
  );
}

describe("TopicsChart", () => {
  // The Spanish labels that were cut off at the right edge (#729): 8 topics, the second one
  // beside the chart with about 160px of room.
  it("puts a label that is too wide for its side on two lines", () => {
    const topics = [
      "Servidor TCP",
      "Cumplimiento del protocolo",
      "Variables de condición",
      "Objetos e inventario",
      "Combate",
      "Misiones",
      "Clientes CLI y GUI",
      "Registro del servidor",
    ].map((label) => ({ label, icon: "" }));

    render(<TopicsChart projectName="The Answer Protocol" topics={topics} />);

    expect(labelLines().slice(0, 3)).toEqual([
      ["SERVIDOR TCP"],
      ["CUMPLIMIENTO", "DEL PROTOCOLO"],
      ["VARIABLES", "DE CONDICIÓN"],
    ]);
  });

  it("splits at the space that keeps the longer line shortest", () => {
    expect(wrapLabel("SEGURIDAD DEL SANDBOX", 160)).toEqual(["SEGURIDAD", "DEL SANDBOX"]);
    expect(wrapLabel("PREVENCIÓN DE INTERBLOQUEOS", 160)).toEqual([
      "PREVENCIÓN DE",
      "INTERBLOQUEOS",
    ]);
  });

  it("keeps a label that fits, or a single long word, on one line", () => {
    expect(wrapLabel("COMBATE", 160)).toEqual(["COMBATE"]);
    expect(wrapLabel("BENCHMARKINGANDMORE", 100)).toEqual(["BENCHMARKINGANDMORE"]);
  });
});
