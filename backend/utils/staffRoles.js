const STAFF_DESIGNATIONS = [
  'sales_executive',
  'sales_manager',
  'branch_manager',
  'gm',
  'ceo',
  'md'
];

const DESIGNATION_LABELS = {
  sales_executive: 'Sales Executive',
  sales_manager: 'Sales Manager',
  branch_manager: 'Branch Manager',
  gm: 'GM',
  ceo: 'CEO',
  md: 'MD'
};

const DESIGNATION_SORT_ORDER = {
  sales_executive: 1,
  sales_manager: 2,
  branch_manager: 3,
  gm: 4,
  ceo: 5,
  md: 6
};

/** Maps business designation → auth role for existing middleware */
const DESIGNATION_TO_AUTH_ROLE = {
  sales_executive: 'executive',
  sales_manager: 'manager',
  branch_manager: 'manager',
  gm: 'manager',
  ceo: 'superadmin',
  md: 'superadmin'
};

function designationLabel(designation) {
  if (!designation) return null;
  return DESIGNATION_LABELS[designation] || designation;
}

function authRoleForDesignation(designation) {
  return DESIGNATION_TO_AUTH_ROLE[designation] || 'executive';
}

function compareByDesignation(a, b) {
  const orderA = DESIGNATION_SORT_ORDER[a.designation] ?? 99;
  const orderB = DESIGNATION_SORT_ORDER[b.designation] ?? 99;
  if (orderA !== orderB) return orderA - orderB;
  return (a.name || '').localeCompare(b.name || '');
}

module.exports = {
  STAFF_DESIGNATIONS,
  DESIGNATION_LABELS,
  DESIGNATION_SORT_ORDER,
  DESIGNATION_TO_AUTH_ROLE,
  designationLabel,
  authRoleForDesignation,
  compareByDesignation
};
