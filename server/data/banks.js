export const banks = [
  {
    id: "bosl",
    name: "Bank of Saint Lucia (BOSL)",
    shortName: "BOSL",
    accountName: process.env.BOSL_ACCOUNT_NAME || "The Liyelle Atelier",
    accountNumber: process.env.BOSL_ACCOUNT_NUMBER || "",
    branch: process.env.BOSL_BRANCH || "",
  },
  {
    id: "cibc",
    name: "CIBC FirstCaribbean",
    shortName: "CIBC",
    accountName: process.env.CIBC_ACCOUNT_NAME || "The Liyelle Atelier",
    accountNumber: process.env.CIBC_ACCOUNT_NUMBER || "",
    branch: process.env.CIBC_BRANCH || "",
  },
  {
    id: "1st-national",
    name: "1st National Bank",
    shortName: "1st National",
    accountName: process.env.FIRST_NATIONAL_ACCOUNT_NAME || "The Liyelle Atelier",
    accountNumber: process.env.FIRST_NATIONAL_ACCOUNT_NUMBER || "",
    branch: process.env.FIRST_NATIONAL_BRANCH || "",
  },
  {
    id: "republic",
    name: "Republic Bank",
    shortName: "Republic",
    accountName: process.env.REPUBLIC_ACCOUNT_NAME || "The Liyelle Atelier",
    accountNumber: process.env.REPUBLIC_ACCOUNT_NUMBER || "",
    branch: process.env.REPUBLIC_BRANCH || "",
  },
];
