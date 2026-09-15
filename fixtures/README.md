# Fixtures

Drop the exported workbooks here as `.xlsx`, one per account:

    ongora-simba-2025-26.xlsx
    ongora-gpa-2025-26.xlsx
    ongora-operations-2025-26.xlsx
    ongora-infrastructure-2023-24.xlsx
    pith-nyakembene-tuition-2023-24.xlsx
    nyangubo-boarding-2024-25.xlsx

These are the golden master. A fixture test loads a workbook's cash book into the
engine and asserts the generated trial balance matches the one in the workbook,
month by month. Where they disagree, decide which is wrong and write the reason
into the test — several months in the boarding workbook do not balance.

Never edit a fixture to make a test pass.
