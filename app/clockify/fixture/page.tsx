import { notFound } from "next/navigation";
import ClockifyVisualFixture from "./visual-fixture";

export const dynamic = "force-dynamic";

export default function ClockifyFixturePage(): JSX.Element {
  if (process.env.NODE_ENV === "production") notFound();
  return <ClockifyVisualFixture />;
}
