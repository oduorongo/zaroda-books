import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_BYTES, documentProblem, infrastructurePaymentProblem, missingDocumentsWarning,
  projectKey, scdeAuditBlock,
} from "../documents";

describe("projectKey, which names are the same project", () => {
  it("ignores case, spacing and punctuation", () => {
    expect(projectKey("  Construction of  2 Classrooms. ")).toBe(projectKey("construction of 2 classrooms"));
  });

  it("keeps different projects apart", () => {
    expect(projectKey("Toilets")).not.toBe(projectKey("Classrooms"));
  });
});

describe("documentProblem", () => {
  it("accepts photos and PDFs within the size limit", () => {
    expect(documentProblem({ type: "image/jpeg", size: 300_000 })).toBeNull();
    expect(documentProblem({ type: "application/pdf", size: MAX_DOCUMENT_BYTES })).toBeNull();
  });

  it("refuses an empty file, an oversized one and other kinds of file", () => {
    expect(documentProblem({ type: "image/png", size: 0 })).toMatch(/empty/i);
    expect(documentProblem({ type: "application/pdf", size: MAX_DOCUMENT_BYTES + 1 })).toMatch(/4 MB/);
    expect(documentProblem({ type: "application/zip", size: 10 })).toMatch(/photo or a PDF/i);
  });
});

describe("infrastructurePaymentProblem", () => {
  const base = { takesProject: true, exempt: false, project: "Classrooms", letterAttached: true };

  it("lets a payment through once its project has the SCDE letter", () => {
    expect(infrastructurePaymentProblem(base)).toBeNull();
  });

  it("asks which project an infrastructure payment is for", () => {
    expect(infrastructurePaymentProblem({ ...base, project: " " })).toMatch(/which project/i);
  });

  it("refuses a payment for a project whose SCDE approval is not attached", () => {
    expect(infrastructurePaymentProblem({ ...base, letterAttached: false })).toMatch(/SCDE approval.*Classrooms/i);
  });

  it("leaves other accounts and exempt books alone", () => {
    expect(infrastructurePaymentProblem({ ...base, takesProject: false, project: "" })).toBeNull();
    expect(infrastructurePaymentProblem({ ...base, exempt: true, project: "", letterAttached: false })).toBeNull();
  });
});

describe("scdeAuditBlock", () => {
  it("names the payments without an approved project", () => {
    const why = scdeAuditBlock([{ vrNo: "4", project: "Toilets" }, { vrNo: "9", project: null }]);
    expect(why).toMatch(/VR 4 \(Toilets\)/);
    expect(why).toMatch(/VR 9 \(no project named\)/);
  });

  it("is silent when every project is approved", () => {
    expect(scdeAuditBlock([])).toBeNull();
  });
});

describe("missingDocumentsWarning", () => {
  it("warns, naming the vouchers, without stopping anything", () => {
    expect(missingDocumentsWarning(["2", "5"])).toMatch(/2 payments have no supporting documents: VR 2, 5/);
    expect(missingDocumentsWarning([])).toBeNull();
  });
});
