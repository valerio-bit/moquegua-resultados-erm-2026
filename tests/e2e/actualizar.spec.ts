import { expect, test } from "@playwright/test";

test.describe("Actualizar / Publicar", () => {
  test("carga la versión publicada y bloquea la publicación sin importación", async ({ page }) => {
    await page.goto("/actualizar/");
    await expect(page.getByTestId("published-version")).toContainText("Registros: 164");
    await expect(page.getByTestId("publish-button")).toBeDisabled();
    await page.getByRole("button", { name: "Validar" }).click();
    await expect(page.getByTestId("validation-summary")).toContainText("Sin fallos críticos");
  });

  test("Actualizar desde ONPE informa del bloqueo sin evadirlo", async ({ page }) => {
    await page.route("https://resultadoelectoral.onpe.gob.pe/**", (route) =>
      route.fulfill({ status: 403, body: "", headers: { "x-amzn-waf-action": "block" } }),
    );
    await page.goto("/actualizar/");
    await page.getByRole("button", { name: "Actualizar desde ONPE" }).click();
    await expect(page.getByTestId("admin-log")).toContainText("No se intenta evadir la protección");
  });

  test("importar CSV válido, comparar, validar y habilitar la versión publicable", async ({ page, request }) => {
    const csv = await (await request.get("/datos/resultados.csv")).text();
    await page.goto("/actualizar/");
    await expect(page.getByTestId("published-version")).toBeVisible();
    await page.getByTestId("csv-input").setInputFiles({ name: "resultados.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByTestId("candidate-version")).toContainText("CSV (resultados.csv)");
    await page.getByRole("button", { name: "Comparar versión" }).click();
    await expect(page.getByTestId("diff-view")).toContainText("Con votos distintos");
    await page.getByRole("button", { name: "Validar" }).click();
    await expect(page.getByTestId("validation-summary")).toContainText("Sin fallos críticos");
    await expect(page.getByTestId("publish-button")).toBeEnabled();
    const download = page.waitForEvent("download");
    await page.getByTestId("publish-button").click();
    expect((await download).suggestedFilename()).toBe("dataset.json");
  });

  test("un CSV con totales que no cuadran no puede publicarse", async ({ page, request }) => {
    const lines = (await (await request.get("/datos/resultados.csv")).text()).replace(/^﻿/, "").split("\n");
    const header = lines[0]!.split(",");
    const vi = header.indexOf("votes");
    const cells = lines[1]!.split(",");
    cells[vi] = String(Number(cells[vi]) + 999);
    lines[1] = cells.join(",");
    await page.goto("/actualizar/");
    await expect(page.getByTestId("published-version")).toBeVisible();
    await page.getByTestId("csv-input").setInputFiles({ name: "alterado.csv", mimeType: "text/csv", buffer: Buffer.from(lines.join("\n")) });
    await expect(page.getByTestId("candidate-version")).toBeVisible();
    await page.getByRole("button", { name: "Comparar versión" }).click();
    await page.getByRole("button", { name: "Validar" }).click();
    await expect(page.getByTestId("validation-summary")).toContainText("Publicación bloqueada");
    await expect(page.getByTestId("publish-button")).toBeDisabled();
    await expect(page.getByTestId("publish-blockers")).toContainText("validaciones críticas fallidas");
  });

  test("rechaza un JSON que no es una captura válida", async ({ page }) => {
    await page.goto("/actualizar/");
    await expect(page.getByTestId("published-version")).toBeVisible();
    await page.getByTestId("json-input").setInputFiles({ name: "suelta.json", mimeType: "application/json", buffer: Buffer.from('{"data":[],"success":true}') });
    await expect(page.getByTestId("admin-log")).toContainText("respuesta ONPE suelta");
    await expect(page.getByTestId("candidate-version")).toHaveCount(0);
  });
});
