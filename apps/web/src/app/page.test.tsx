import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import HomePage from "@/app/page";

test("exposes the temporary announcement through a main landmark and heading", () => {
  render(<HomePage />);

  const main = screen.getByRole("main");
  expect(
    within(main).getByRole("heading", { level: 1, name: "Distrito Hobby" }),
  ).toBeVisible();
  expect(within(main).getByText("Something awesome is coming.")).toBeVisible();
});
