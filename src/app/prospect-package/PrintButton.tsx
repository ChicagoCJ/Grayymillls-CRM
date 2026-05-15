"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="w-fit rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
    >
      Print / Save as PDF
    </button>
  );
}