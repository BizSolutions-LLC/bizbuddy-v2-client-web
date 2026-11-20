// Loaded on demand by the sidebar for admin accounts only.
// A whole group, placed before `before` (or at the end when that group isn't there).
const entry = {
  before: "account",
  group: {
    id: "security",
    label: "Security",
    children: [{ id: "company/employee-logins", label: "Employee Logins" }],
  },
};

export default entry;
