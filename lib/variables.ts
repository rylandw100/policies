import { VariableNode, VariablePath } from "@/components/variable-picker";
import { flattenVariableTree } from "./flatten-variables";

// Helper function to deep clone a VariableNode and add changeState to all paths
function cloneNodeWithChangeState(node: VariableNode, changeState: "before" | "after"): VariableNode {
  const cloned: VariableNode = {
    ...node,
    children: node.children ? node.children.map(child => cloneNodeWithChangeState(child, changeState)) : undefined,
  };
  
  // Add changeState to path if it exists
  if (cloned.path) {
    cloned.path = {
      ...cloned.path,
      changeState,
    };
  }
  
  return cloned;
}

// Helper function to duplicate fields in a category with before/after changeStates
function duplicateFieldsInCategory(category: VariableNode): VariableNode {
  if (!category.children || category.type !== "category") {
    return category;
  }
  
  const duplicatedFields: VariableNode[] = [];
  
  // For each field, create two copies - one with "before" and one with "after"
  category.children.forEach(field => {
    if (field.type === "field" && field.path) {
      const beforeField = cloneNodeWithChangeState(field, "before");
      const afterField = cloneNodeWithChangeState(field, "after");
      
      // Update IDs to make them unique
      beforeField.id = `${field.id}-before`;
      afterField.id = `${field.id}-after`;
      
      duplicatedFields.push(beforeField, afterField);
    } else {
      // For non-field children, just add them as-is
      duplicatedFields.push(field);
    }
  });
  
  return {
    ...category,
    children: duplicatedFields,
  };
}

// Helper function to clone a category for Manager with updated paths
function cloneCategoryForManager(category: VariableNode): VariableNode {
  const cloned = JSON.parse(JSON.stringify(category));
  
  // Recursively update paths to include "Manager" in the category path
  const updatePaths = (node: VariableNode) => {
    if (node.path) {
      node.path = {
        ...node.path,
        category: `Manager > ${node.path.category}`,
      };
    }
    if (node.children) {
      node.children.forEach(updatePaths);
    }
  };
  
  updatePaths(cloned);
  
  // Update the category ID to make it unique
  cloned.id = `manager-${category.id}`;
  
  return cloned;
}

// Generate variable structure for Trigger step
export function generateTriggerVariables(showChangeStates?: boolean): VariableNode {
  // Define the Employee object structure
  const employeeObject: VariableNode = {
    id: "employee",
    name: "Employee",
    type: "object",
        children: [
          {
            id: "authentication-settings",
            name: "Authentication settings",
            type: "category",
            children: [
              {
                id: "twoFactorEnabled",
                name: "Two-factor authentication enabled",
                type: "field",
                fieldType: "boolean",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Authentication settings",
                  field: "Two-factor authentication enabled",
                },
              },
              {
                id: "passwordLastChanged",
                name: "Password last changed",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Authentication settings",
                  field: "Password last changed",
                },
              },
              {
                id: "loginMethod",
                name: "Login method",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Authentication settings",
                  field: "Login method",
                },
              },
            ],
          },
          {
            id: "compensation",
            name: "Compensation",
            type: "category",
            children: [
              {
                id: "baseSalary",
                name: "Base salary",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Compensation",
                  field: "Base salary",
                },
              },
              {
                id: "currency",
                name: "Currency",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Compensation",
                  field: "Currency",
                },
              },
              {
                id: "payFrequency",
                name: "Pay frequency",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Compensation",
                  field: "Pay frequency",
                },
              },
              {
                id: "effectiveDate",
                name: "Effective date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Compensation",
                  field: "Effective date",
                },
              },
            ],
          },
          {
            id: "compensation-band",
            name: "Compensation Band",
            type: "category",
            children: [
              {
                id: "bandLevel",
                name: "Band level",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Compensation Band",
                  field: "Band level",
                },
              },
              {
                id: "bandMin",
                name: "Band minimum",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Compensation Band",
                  field: "Band minimum",
                },
              },
              {
                id: "bandMax",
                name: "Band maximum",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Compensation Band",
                  field: "Band maximum",
                },
              },
            ],
          },
          {
            id: "country-specific-employment-info",
            name: "Country-specific employment information",
            type: "category",
            children: [
              {
                id: "country",
                name: "Country",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Country-specific employment information",
                  field: "Country",
                },
              },
              {
                id: "employmentType",
                name: "Employment type",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Country-specific employment information",
                  field: "Employment type",
                },
              },
              {
                id: "taxId",
                name: "Tax ID",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Country-specific employment information",
                  field: "Tax ID",
                },
              },
            ],
          },
          {
            id: "country-specific-personal-info",
            name: "Country-specific personal information",
            type: "category",
            children: [
              {
                id: "nationalId",
                name: "National ID",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Country-specific personal information",
                  field: "National ID",
                },
              },
              {
                id: "passportNumber",
                name: "Passport number",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Country-specific personal information",
                  field: "Passport number",
                },
              },
              {
                id: "citizenship",
                name: "Citizenship",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Country-specific personal information",
                  field: "Citizenship",
                },
              },
            ],
          },
          {
            id: "custom-fields",
            name: "Custom Fields",
            type: "category",
            children: [
              {
                id: "customField1",
                name: "Custom field 1",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Custom Fields",
                  field: "Custom field 1",
                },
              },
              {
                id: "customField2",
                name: "Custom field 2",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Custom Fields",
                  field: "Custom field 2",
                },
              },
            ],
          },
          {
            id: "employee-details",
            name: "Employee Details",
            type: "category",
            children: [
              {
                id: "employeeId",
                name: "Employee ID",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee Details",
                  field: "Employee ID",
                },
              },
              {
                id: "jobTitle",
                name: "Job title",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee Details",
                  field: "Job title",
                },
              },
              {
                id: "department",
                name: "Department",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee Details",
                  field: "Department",
                },
              },
              {
                id: "manager",
                name: "Manager",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee Details",
                  field: "Manager",
                },
              },
            ],
          },
          {
            id: "employee-contractor-details",
            name: "Employee contractor details",
            type: "category",
            children: [
              {
                id: "contractorType",
                name: "Contractor type",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee contractor details",
                  field: "Contractor type",
                },
              },
              {
                id: "contractStartDate",
                name: "Contract start date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee contractor details",
                  field: "Contract start date",
                },
              },
              {
                id: "contractEndDate",
                name: "Contract end date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee contractor details",
                  field: "Contract end date",
                },
              },
            ],
          },
          {
            id: "employee-insurance-fields",
            name: "Employee insurance fields",
            type: "category",
            children: [
              {
                id: "insuranceProvider",
                name: "Insurance provider",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee insurance fields",
                  field: "Insurance provider",
                },
              },
              {
                id: "policyNumber",
                name: "Policy number",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee insurance fields",
                  field: "Policy number",
                },
              },
              {
                id: "coverageType",
                name: "Coverage type",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee insurance fields",
                  field: "Coverage type",
                },
              },
            ],
          },
          {
            id: "employee-login-details",
            name: "Employee login details",
            type: "category",
            children: [
              {
                id: "username",
                name: "Username",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee login details",
                  field: "Username",
                },
              },
              {
                id: "lastLogin",
                name: "Last login",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee login details",
                  field: "Last login",
                },
              },
              {
                id: "accountStatus",
                name: "Account status",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee login details",
                  field: "Account status",
                },
              },
            ],
          },
          {
            id: "employee-personal-information",
            name: "Employee personal information",
            type: "category",
            children: [
              {
                id: "maritalStatus",
                name: "Marital status",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee personal information",
                  field: "Marital status",
                },
              },
              {
                id: "dependents",
                name: "Dependents",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee personal information",
                  field: "Dependents",
                },
              },
              {
                id: "bloodType",
                name: "Blood type",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee personal information",
                  field: "Blood type",
                },
              },
            ],
          },
          {
            id: "employee-info",
            name: "Employee information",
            type: "category",
            children: [
              {
                id: "dateOfBirth",
                name: "Date of birth",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Date of birth",
                },
              },
              {
                id: "eeocEthnicity",
                name: "EEOC Ethnicity",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "EEOC Ethnicity",
                },
              },
              {
                id: "eeocGender",
                name: "EEOC Gender",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "EEOC Gender",
                },
              },
              {
                id: "emergencyContactName",
                name: "Emergency contact name",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Emergency contact name",
                },
              },
              {
                id: "emergencyContactPhoneNumber",
                name: "Emergency contact phone number",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Emergency contact phone number",
                },
              },
              {
                id: "employeeTimezone",
                name: "Employee Timezone",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Employee Timezone",
                },
              },
              {
                id: "employeeLocaleSettings",
                name: "Employee locale settings",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Employee locale settings",
                },
              },
              {
                id: "employeeNameDetails",
                name: "Employee name details",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Employee name details",
                },
              },
              {
                id: "expectedDateForSSN",
                name: "Expected date for SSN",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Expected date for SSN",
                },
              },
              {
                id: "fullHomeAddress",
                name: "Full home address",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Full home address",
                },
              },
              {
                id: "fullName",
                name: "Full name",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Full name",
                },
              },
              {
                id: "homeAddress",
                name: "Home address",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Home address",
                },
              },
              {
                id: "identifiedGender",
                name: "Identified gender",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Identified gender",
                },
              },
              {
                id: "legalGender",
                name: "Legal gender",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Legal gender",
                },
              },
              {
                id: "personalEmail",
                name: "Personal email",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Personal email",
                },
              },
              {
                id: "phoneNumber",
                name: "Phone number",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Phone number",
                },
              },
              {
                id: "preferredFirstName",
                name: "Preferred first name",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Preferred first name",
                },
              },
              {
                id: "preferredLastName",
                name: "Preferred last name",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "Preferred last name",
                },
              },
              {
                id: "ssn",
                name: "SSN",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "SSN",
                },
              },
              {
                id: "tshirtSize",
                name: "T-shirt size",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employee information",
                  field: "T-shirt size",
                },
              },
            ],
          },
          {
            id: "employment-information",
            name: "Employment information",
            type: "category",
            children: [
              {
                id: "hireDate",
                name: "Hire date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employment information",
                  field: "Hire date",
                },
              },
              {
                id: "employmentType",
                name: "Employment type",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employment information",
                  field: "Employment type",
                },
              },
              {
                id: "workLocation",
                name: "Work location",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employment information",
                  field: "Work location",
                },
              },
              {
                id: "workSchedule",
                name: "Work schedule",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employment information",
                  field: "Work schedule",
                },
              },
            ],
          },
          {
            id: "employment-status",
            name: "Employment status",
            type: "category",
            children: [
              {
                id: "status",
                name: "Status",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employment status",
                  field: "Status",
                },
              },
              {
                id: "statusEffectiveDate",
                name: "Status effective date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employment status",
                  field: "Status effective date",
                },
              },
              {
                id: "terminationDate",
                name: "Termination date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Employment status",
                  field: "Termination date",
                },
              },
            ],
          },
          {
            id: "entity-contractor-details",
            name: "Entity contractor details",
            type: "category",
            children: [
              {
                id: "entityName",
                name: "Entity name",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Entity contractor details",
                  field: "Entity name",
                },
              },
              {
                id: "entityTaxId",
                name: "Entity tax ID",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Entity contractor details",
                  field: "Entity tax ID",
                },
              },
              {
                id: "contractorRate",
                name: "Contractor rate",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Entity contractor details",
                  field: "Contractor rate",
                },
              },
            ],
          },
          {
            id: "entity-information",
            name: "Entity information",
            type: "category",
            children: [
              {
                id: "entityId",
                name: "Entity ID",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Entity information",
                  field: "Entity ID",
                },
              },
              {
                id: "entityType",
                name: "Entity type",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Entity information",
                  field: "Entity type",
                },
              },
              {
                id: "entityCode",
                name: "Entity code",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Entity information",
                  field: "Entity code",
                },
              },
            ],
          },
          {
            id: "fsa-benefits",
            name: "FSA benefits",
            type: "category",
            children: [
              {
                id: "fsaElection",
                name: "FSA election",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "FSA benefits",
                  field: "FSA election",
                },
              },
              {
                id: "fsaPlanYear",
                name: "FSA plan year",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "FSA benefits",
                  field: "FSA plan year",
                },
              },
              {
                id: "fsaContribution",
                name: "FSA contribution",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "FSA benefits",
                  field: "FSA contribution",
                },
              },
            ],
          },
          {
            id: "leaves",
            name: "Leaves",
            type: "category",
            children: [
              {
                id: "leaveBalance",
                name: "Leave balance",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Leaves",
                  field: "Leave balance",
                },
              },
              {
                id: "leaveType",
                name: "Leave type",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Leaves",
                  field: "Leave type",
                },
              },
              {
                id: "leaveStartDate",
                name: "Leave start date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Leaves",
                  field: "Leave start date",
                },
              },
              {
                id: "leaveEndDate",
                name: "Leave end date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Leaves",
                  field: "Leave end date",
                },
              },
            ],
          },
          {
            id: "payroll",
            name: "Payroll",
            type: "category",
            children: [
              {
                id: "payrollId",
                name: "Payroll ID",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Payroll",
                  field: "Payroll ID",
                },
              },
              {
                id: "bankAccount",
                name: "Bank account",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Payroll",
                  field: "Bank account",
                },
              },
              {
                id: "routingNumber",
                name: "Routing number",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Payroll",
                  field: "Routing number",
                },
              },
              {
                id: "taxWithholding",
                name: "Tax withholding",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Payroll",
                  field: "Tax withholding",
                },
              },
            ],
          },
          {
            id: "recruiting",
            name: "Recruiting",
            type: "category",
            children: [
              {
                id: "applicantId",
                name: "Applicant ID",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Recruiting",
                  field: "Applicant ID",
                },
              },
              {
                id: "applicationDate",
                name: "Application date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Recruiting",
                  field: "Application date",
                },
              },
              {
                id: "interviewDate",
                name: "Interview date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Recruiting",
                  field: "Interview date",
                },
              },
              {
                id: "offerDate",
                name: "Offer date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Recruiting",
                  field: "Offer date",
                },
              },
            ],
          },
          {
            id: "third-party-apps",
            name: "Third Party Apps",
            type: "category",
            children: [
              {
                id: "appName",
                name: "App name",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Third Party Apps",
                  field: "App name",
                },
              },
              {
                id: "appUserId",
                name: "App user ID",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Third Party Apps",
                  field: "App user ID",
                },
              },
              {
                id: "appStatus",
                name: "App status",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Third Party Apps",
                  field: "App status",
                },
              },
            ],
          },
          {
            id: "time-off",
            name: "Time off",
            type: "category",
            children: [
              {
                id: "ptoBalance",
                name: "PTO balance",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Time off",
                  field: "PTO balance",
                },
              },
              {
                id: "ptoRequested",
                name: "PTO requested",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Time off",
                  field: "PTO requested",
                },
              },
              {
                id: "sickLeaveBalance",
                name: "Sick leave balance",
                type: "field",
                fieldType: "number",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Time off",
                  field: "Sick leave balance",
                },
              },
              {
                id: "timeOffRequestDate",
                name: "Time off request date",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Time off",
                  field: "Time off request date",
                },
              },
            ],
          },
          {
            id: "work-authorization-details",
            name: "Work authorization details",
            type: "category",
            children: [
              {
                id: "workAuthorizationType",
                name: "Work authorization type",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Work authorization details",
                  field: "Work authorization type",
                },
              },
              {
                id: "workAuthorizationNumber",
                name: "Work authorization number",
                type: "field",
                fieldType: "string",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Work authorization details",
                  field: "Work authorization number",
                },
              },
              {
                id: "workAuthorizationExpiry",
                name: "Work authorization expiry",
                type: "field",
                fieldType: "date",
                path: {
                  step: "trigger",
                  object: "Employee",
                  category: "Work authorization details",
                  field: "Work authorization expiry",
                },
              },
            ],
          },
        ],
      };

  // Build children array - duplicate fields in Employee categories if showChangeStates is true
  // Also add Manager category that contains all Employee categories
  const children: VariableNode[] = [];
  
  // Helper function to process Employee categories (duplicate fields if needed)
  const processEmployeeCategories = (categories: VariableNode[] | undefined): VariableNode[] | undefined => {
    if (!categories) return undefined;
    return categories.map(category => {
      if (category.type === "category") {
        return showChangeStates ? duplicateFieldsInCategory(category) : category;
      }
      return category;
    });
  };
  
  if (showChangeStates) {
    // Duplicate fields within each category of the Employee object
    const processedCategories = processEmployeeCategories(employeeObject.children);
    
    // Create Manager category with all Employee categories (excluding Manager itself)
    const managerCategory: VariableNode = {
      id: "manager",
      name: "Manager",
      type: "category",
      children: employeeObject.children
        ?.filter(cat => cat.type === "category" && cat.id !== "manager")
        .map(cat => {
          // Clone category for Manager, but also duplicate fields if showChangeStates is true
          const cloned = cloneCategoryForManager(cat);
          if (showChangeStates) {
            return duplicateFieldsInCategory(cloned);
          }
          return cloned;
        }),
    };
    
    // Combine Manager category with other categories and sort alphabetically
    const allCategories = [
      managerCategory,
      ...(processedCategories || []),
    ].sort((a, b) => a.name.localeCompare(b.name));
    
    const employeeWithDuplicatedFields: VariableNode = {
      ...employeeObject,
      children: allCategories,
    };
    
    children.push(employeeWithDuplicatedFields);
  } else {
    // Single Employee object without changeState
    const processedCategories = processEmployeeCategories(employeeObject.children);
    
    // Create Manager category with all Employee categories (excluding Manager itself)
    const managerCategory: VariableNode = {
      id: "manager",
      name: "Manager",
      type: "category",
      children: employeeObject.children
        ?.filter(cat => cat.type === "category" && cat.id !== "manager")
        .map(cat => cloneCategoryForManager(cat)),
    };
    
    // Combine Manager category with other categories and sort alphabetically
    const allCategories = [
      managerCategory,
      ...(processedCategories || []),
    ].sort((a, b) => a.name.localeCompare(b.name));
    
    const employeeWithManager: VariableNode = {
      ...employeeObject,
      children: allCategories,
    };
    
    children.push(employeeWithManager);
  }
  
  // Add Event details object
  children.push({
    id: "event-details",
    name: "Event details",
    type: "object",
    children: [
      {
        id: "event-details-category",
        name: "Event details",
        type: "category",
        children: [
          {
            id: "requestedAt",
            name: "Requested at",
            type: "field",
            fieldType: "date",
            path: {
              step: "trigger",
              object: "Event details",
              category: "Event details",
              field: "Requested at",
            },
          },
          {
            id: "requestedBy",
            name: "Requested by",
            type: "field",
            fieldType: "string",
            path: {
              step: "trigger",
              object: "Event details",
              category: "Event details",
              field: "Requested by",
            },
          },
          {
            id: "effectiveFrom",
            name: "Effective from",
            type: "field",
            fieldType: "date",
            path: {
              step: "trigger",
              object: "Event details",
              category: "Event details",
              field: "Effective from",
            },
          },
        ],
      },
    ],
  });

  return {
    id: "trigger",
    name: "Trigger event",
    type: "step",
    stepName: showChangeStates ? "Profile change is effective" : "rwebb_object is created",
    stepId: "ID: 1",
    stepIcon: "zap",
    children,
  };
}

// Generate variable structure for AI Prompt step
export function generateAIPromptVariables(
  outputFormat: string,
  jsonProperties?: Array<{ name: string; type: string; description: string }>
): VariableNode {
  const children: VariableNode[] = [];

  if (outputFormat === "Text") {
    // If output format is Text, output a string variable called "AI output"
    children.push({
      id: "ai-prompt-output",
      name: "AI prompt output",
      type: "object",
      children: [
        {
          id: "ai-prompt-output-category",
          name: "AI prompt output",
          type: "category",
          children: [
            {
              id: "ai-output",
              name: "AI output",
              type: "field",
              fieldType: "string",
              path: {
                step: "aiPrompt",
                object: "AI prompt output",
                category: "AI prompt output",
                field: "AI output",
              },
            },
          ],
        },
      ],
    });
  } else if (outputFormat === "JSON" && jsonProperties && jsonProperties.length > 0) {
    // If output format is JSON, create variables matching the JSON schema properties
    const fields: VariableNode[] = jsonProperties
      .filter((prop) => prop.name.trim() !== "")
      .map((prop) => {
        // Map JSON schema types to field types
        let fieldType: "string" | "number" | "boolean" | "object" | "date" | "array" = "string";
        if (prop.type === "NUM") fieldType = "number";
        else if (prop.type === "BOOL") fieldType = "boolean";
        else if (prop.type === "OBJ") fieldType = "object";
        else if (prop.type === "ARR") fieldType = "array";

        return {
          id: `ai-json-${prop.name}`,
          name: prop.name,
          type: "field" as const,
          fieldType: fieldType as "string" | "number" | "boolean" | "object" | "date" | "array",
          path: {
            step: "aiPrompt",
            object: "AI prompt output",
            category: "AI prompt output",
            field: prop.name,
          },
        };
      });

    if (fields.length > 0) {
      children.push({
        id: "ai-prompt-output",
        name: "AI prompt output",
        type: "object",
        children: [
          {
            id: "ai-prompt-output-category",
            name: "AI prompt output",
            type: "category",
            children: fields,
          },
        ],
      });
    }
  }

  return {
    id: "aiPrompt",
    name: "AI prompt",
    type: "step",
    stepName: "Prompt 1",
    stepId: "ID: 12",
    stepIcon: "sparkles",
    children,
  };
}

// Generate variable structure for Documents page
export function generateDocumentVariables(): VariableNode[] {
  // Get Employee object from trigger variables (without the trigger wrapper)
  const triggerVars = generateTriggerVariables();
  const employeeObjectRaw = triggerVars.children?.find(child => child.id === "employee");
  
  // Deep clone the Employee object to avoid reference issues
  const employeeObject: VariableNode | undefined = employeeObjectRaw ? JSON.parse(JSON.stringify(employeeObjectRaw)) : undefined;
  
  // Create Document custom variables with the specified categories
  // Each category needs at least one placeholder field to be visible
  const documentCustomVariables: VariableNode = {
    id: "document-custom-variables",
    name: "Document custom variables",
    type: "object",
    children: [
      {
        id: "custom-information",
        name: "Custom information",
        type: "category",
        children: [
          {
            id: "choice-custom-field",
            name: "Choice custom field",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Custom information",
              field: "Choice custom field",
            },
          },
          {
            id: "tshirtsize-static",
            name: "TshirtsizeStatic",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Custom information",
              field: "TshirtsizeStatic",
            },
          },
          {
            id: "desired-raise",
            name: "DesiredRaise",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Custom information",
              field: "DesiredRaise",
            },
          },
          {
            id: "tenure-years",
            name: "Tenure (years)",
            type: "field",
            fieldType: "number",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Custom information",
              field: "Tenure (years)",
            },
          },
          {
            id: "start-date-current-entity",
            name: "Start date with current entity",
            type: "field",
            fieldType: "date",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Custom information",
              field: "Start date with current entity",
            },
          },
          {
            id: "test-permission-profiles",
            name: "Test permission Profiles",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Custom information",
              field: "Test permission Profiles",
            },
          },
          {
            id: "days-since-custom-field",
            name: "Days since custom field",
            type: "field",
            fieldType: "number",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Custom information",
              field: "Days since custom field",
            },
          },
          {
            id: "tenure-in-days-ff",
            name: "Tenure in days FF",
            type: "field",
            fieldType: "number",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Custom information",
              field: "Tenure in days FF",
            },
          },
          {
            id: "home-zip",
            name: "Home zip",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Custom information",
              field: "Home zip",
            },
          },
          {
            id: "same-field-no-decimals",
            name: "Same field with no decimals",
            type: "field",
            fieldType: "number",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Custom information",
              field: "Same field with no decimals",
            },
          },
        ],
      },
      {
        id: "signature",
        name: "Signature",
        type: "category",
        children: [
          {
            id: "termination-signatory-name",
            name: "Termination signatory name",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Termination signatory name",
            },
          },
          {
            id: "termination-signatory-title",
            name: "Termination signatory title",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Termination signatory title",
            },
          },
          {
            id: "termination-signatory-signature",
            name: "Termination signatory signature",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Termination signatory signature",
            },
          },
          {
            id: "termination-signatory-date-signed",
            name: "Termination signatory date signed",
            type: "field",
            fieldType: "date",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Termination signatory date signed",
            },
          },
          {
            id: "company-signatory-name",
            name: "Company signatory name",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Company signatory name",
            },
          },
          {
            id: "company-signatory-phone-number",
            name: "Company signatory phone number",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Company signatory phone number",
            },
          },
          {
            id: "company-signatory-title",
            name: "Company signatory title",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Company signatory title",
            },
          },
          {
            id: "company-signatory-signature",
            name: "Company signatory signature",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Company signatory signature",
            },
          },
          {
            id: "company-signatory-date-signed",
            name: "Company signatory date signed",
            type: "field",
            fieldType: "date",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Company signatory date signed",
            },
          },
          {
            id: "employee-signature",
            name: "Employee signature",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Employee signature",
            },
          },
          {
            id: "employee-signature-date",
            name: "Employee signature date",
            type: "field",
            fieldType: "date",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Employee signature date",
            },
          },
          {
            id: "offer-letter-signatory",
            name: "Offer letter signatory",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Signature",
              field: "Offer letter signatory",
            },
          },
        ],
      },
      {
        id: "employment-information",
        name: "Employment Information",
        type: "category",
        children: [
          {
            id: "employment-status",
            name: "Employment status",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Employment status",
            },
          },
          {
            id: "job-title",
            name: "Job title",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Job title",
            },
          },
          {
            id: "department",
            name: "Department",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Department",
            },
          },
          {
            id: "manager-name",
            name: "Manager name",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Manager name",
            },
          },
          {
            id: "start-date",
            name: "Start date",
            type: "field",
            fieldType: "date",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Start date",
            },
          },
          {
            id: "end-date",
            name: "End date",
            type: "field",
            fieldType: "date",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "End date",
            },
          },
          {
            id: "employment-type",
            name: "Employment type",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Employment type",
            },
          },
          {
            id: "work-location",
            name: "Work location",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Work location",
            },
          },
          {
            id: "work-schedule",
            name: "Work schedule",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Work schedule",
            },
          },
          {
            id: "probation-period",
            name: "Probation period",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Probation period",
            },
          },
          {
            id: "notice-period",
            name: "Notice period",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Notice period",
            },
          },
          {
            id: "contract-type",
            name: "Contract type",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Contract type",
            },
          },
          {
            id: "reporting-structure",
            name: "Reporting structure",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Reporting structure",
            },
          },
          {
            id: "job-level",
            name: "Job level",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Job level",
            },
          },
          {
            id: "band-level",
            name: "Band level",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Band level",
            },
          },
          {
            id: "employee-id",
            name: "Employee ID",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Employee ID",
            },
          },
          {
            id: "badge-number",
            name: "Badge number",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Badge number",
            },
          },
          {
            id: "work-email",
            name: "Work email",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Work email",
            },
          },
          {
            id: "work-phone",
            name: "Work phone",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Work phone",
            },
          },
          {
            id: "employee-number",
            name: "Employee number",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Employee number",
            },
          },
          {
            id: "cost-center",
            name: "Cost center",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Cost center",
            },
          },
          {
            id: "business-unit",
            name: "Business unit",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Business unit",
            },
          },
          {
            id: "time-zone",
            name: "Time zone",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Time zone",
            },
          },
          {
            id: "locale",
            name: "Locale",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employment Information",
              field: "Locale",
            },
          },
        ],
      },
      {
        id: "global",
        name: "Global",
        type: "category",
        children: [
          {
            id: "global-company-name",
            name: "Global company name",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global company name",
            },
          },
          {
            id: "global-currency",
            name: "Global currency",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global currency",
            },
          },
          {
            id: "global-date-format",
            name: "Global date format",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global date format",
            },
          },
          {
            id: "global-time-format",
            name: "Global time format",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global time format",
            },
          },
          {
            id: "global-language",
            name: "Global language",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global language",
            },
          },
          {
            id: "global-region",
            name: "Global region",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global region",
            },
          },
          {
            id: "global-timezone",
            name: "Global timezone",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global timezone",
            },
          },
          {
            id: "global-fiscal-year",
            name: "Global fiscal year",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global fiscal year",
            },
          },
          {
            id: "global-tax-id",
            name: "Global tax ID",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global tax ID",
            },
          },
          {
            id: "global-address",
            name: "Global address",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global address",
            },
          },
          {
            id: "global-phone",
            name: "Global phone",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global phone",
            },
          },
          {
            id: "global-email",
            name: "Global email",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global email",
            },
          },
          {
            id: "global-website",
            name: "Global website",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global website",
            },
          },
          {
            id: "global-legal-name",
            name: "Global legal name",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global legal name",
            },
          },
          {
            id: "global-dba",
            name: "Global DBA",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global DBA",
            },
          },
          {
            id: "global-entity-type",
            name: "Global entity type",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global entity type",
            },
          },
          {
            id: "global-country",
            name: "Global country",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global country",
            },
          },
          {
            id: "global-state",
            name: "Global state",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global state",
            },
          },
          {
            id: "global-city",
            name: "Global city",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global city",
            },
          },
          {
            id: "global-zip",
            name: "Global zip",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global zip",
            },
          },
          {
            id: "global-established-date",
            name: "Global established date",
            type: "field",
            fieldType: "date",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global established date",
            },
          },
          {
            id: "global-employee-count",
            name: "Global employee count",
            type: "field",
            fieldType: "number",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Global",
              field: "Global employee count",
            },
          },
        ],
      },
      {
        id: "api-instruction",
        name: "API Instruction",
        type: "category",
        children: [
          {
            id: "api-endpoint",
            name: "API endpoint",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API endpoint",
            },
          },
          {
            id: "api-method",
            name: "API method",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API method",
            },
          },
          {
            id: "api-headers",
            name: "API headers",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API headers",
            },
          },
          {
            id: "api-body",
            name: "API body",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API body",
            },
          },
          {
            id: "api-auth-type",
            name: "API auth type",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API auth type",
            },
          },
          {
            id: "api-token",
            name: "API token",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API token",
            },
          },
          {
            id: "api-key",
            name: "API key",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API key",
            },
          },
          {
            id: "api-secret",
            name: "API secret",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API secret",
            },
          },
          {
            id: "api-version",
            name: "API version",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API version",
            },
          },
          {
            id: "api-timeout",
            name: "API timeout",
            type: "field",
            fieldType: "number",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API timeout",
            },
          },
          {
            id: "api-retry-count",
            name: "API retry count",
            type: "field",
            fieldType: "number",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API retry count",
            },
          },
          {
            id: "api-content-type",
            name: "API content type",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API content type",
            },
          },
          {
            id: "api-response-format",
            name: "API response format",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API response format",
            },
          },
          {
            id: "api-base-url",
            name: "API base URL",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API base URL",
            },
          },
          {
            id: "api-path",
            name: "API path",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API path",
            },
          },
          {
            id: "api-query-params",
            name: "API query params",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API query params",
            },
          },
          {
            id: "api-status-code",
            name: "API status code",
            type: "field",
            fieldType: "number",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API status code",
            },
          },
          {
            id: "api-error-handling",
            name: "API error handling",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API error handling",
            },
          },
          {
            id: "api-rate-limit",
            name: "API rate limit",
            type: "field",
            fieldType: "number",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API rate limit",
            },
          },
          {
            id: "api-cache-duration",
            name: "API cache duration",
            type: "field",
            fieldType: "number",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API cache duration",
            },
          },
          {
            id: "api-webhook-url",
            name: "API webhook URL",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API webhook URL",
            },
          },
          {
            id: "api-callback-url",
            name: "API callback URL",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "API Instruction",
              field: "API callback URL",
            },
          },
        ],
      },
      {
        id: "employee-information",
        name: "Employee Information",
        type: "category",
        children: [
          {
            id: "employee-first-name",
            name: "Employee first name",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee first name",
            },
          },
          {
            id: "employee-last-name",
            name: "Employee last name",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee last name",
            },
          },
          {
            id: "employee-full-name",
            name: "Employee full name",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee full name",
            },
          },
          {
            id: "employee-preferred-name",
            name: "Employee preferred name",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee preferred name",
            },
          },
          {
            id: "employee-email",
            name: "Employee email",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee email",
            },
          },
          {
            id: "employee-phone",
            name: "Employee phone",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee phone",
            },
          },
          {
            id: "employee-date-of-birth",
            name: "Employee date of birth",
            type: "field",
            fieldType: "date",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee date of birth",
            },
          },
          {
            id: "employee-ssn",
            name: "Employee SSN",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee SSN",
            },
          },
          {
            id: "employee-address",
            name: "Employee address",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee address",
            },
          },
          {
            id: "employee-city",
            name: "Employee city",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee city",
            },
          },
          {
            id: "employee-state",
            name: "Employee state",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee state",
            },
          },
          {
            id: "employee-zip",
            name: "Employee zip",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee zip",
            },
          },
          {
            id: "employee-country",
            name: "Employee country",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee country",
            },
          },
          {
            id: "employee-gender",
            name: "Employee gender",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee gender",
            },
          },
          {
            id: "employee-ethnicity",
            name: "Employee ethnicity",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee ethnicity",
            },
          },
          {
            id: "employee-emergency-contact",
            name: "Employee emergency contact",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee emergency contact",
            },
          },
          {
            id: "employee-emergency-phone",
            name: "Employee emergency phone",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee emergency phone",
            },
          },
          {
            id: "employee-marital-status",
            name: "Employee marital status",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee marital status",
            },
          },
          {
            id: "employee-citizenship",
            name: "Employee citizenship",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee citizenship",
            },
          },
          {
            id: "employee-visa-status",
            name: "Employee visa status",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee visa status",
            },
          },
          {
            id: "employee-work-authorization",
            name: "Employee work authorization",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee work authorization",
            },
          },
          {
            id: "employee-preferred-language",
            name: "Employee preferred language",
            type: "field",
            fieldType: "string",
            path: {
              step: "document-custom-variables",
              object: "Document custom variables",
              category: "Employee Information",
              field: "Employee preferred language",
            },
          },
        ],
      },
      {
        id: "company-information",
        name: "Company Information",
        type: "category",
        children: [
          { id: "company-name", name: "Company name", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company name" } },
          { id: "company-legal-name", name: "Company legal name", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company legal name" } },
          { id: "company-dba", name: "Company DBA", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company DBA" } },
          { id: "company-tax-id", name: "Company tax ID", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company tax ID" } },
          { id: "company-ein", name: "Company EIN", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company EIN" } },
          { id: "company-address", name: "Company address", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company address" } },
          { id: "company-city", name: "Company city", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company city" } },
          { id: "company-state", name: "Company state", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company state" } },
          { id: "company-zip", name: "Company zip", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company zip" } },
          { id: "company-country", name: "Company country", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company country" } },
          { id: "company-phone", name: "Company phone", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company phone" } },
          { id: "company-email", name: "Company email", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company email" } },
          { id: "company-website", name: "Company website", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company website" } },
          { id: "company-entity-type", name: "Company entity type", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company entity type" } },
          { id: "company-industry", name: "Company industry", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company industry" } },
          { id: "company-size", name: "Company size", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company size" } },
          { id: "company-founded-date", name: "Company founded date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company founded date" } },
          { id: "company-registration-date", name: "Company registration date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company registration date" } },
          { id: "company-ceo", name: "Company CEO", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company CEO" } },
          { id: "company-hr-contact", name: "Company HR contact", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company HR contact" } },
          { id: "company-hr-email", name: "Company HR email", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company HR email" } },
          { id: "company-hr-phone", name: "Company HR phone", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Company Information", field: "Company HR phone" } },
        ],
      },
      {
        id: "compensation",
        name: "Compensation",
        type: "category",
        children: [
          { id: "base-salary", name: "Base salary", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Base salary" } },
          { id: "annual-salary", name: "Annual salary", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Annual salary" } },
          { id: "hourly-rate", name: "Hourly rate", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Hourly rate" } },
          { id: "pay-frequency", name: "Pay frequency", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Pay frequency" } },
          { id: "currency", name: "Currency", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Currency" } },
          { id: "bonus-amount", name: "Bonus amount", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Bonus amount" } },
          { id: "bonus-percentage", name: "Bonus percentage", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Bonus percentage" } },
          { id: "commission-rate", name: "Commission rate", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Commission rate" } },
          { id: "overtime-rate", name: "Overtime rate", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Overtime rate" } },
          { id: "total-compensation", name: "Total compensation", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Total compensation" } },
          { id: "target-bonus", name: "Target bonus", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Target bonus" } },
          { id: "stock-options", name: "Stock options", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Stock options" } },
          { id: "rsu-grant", name: "RSU grant", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "RSU grant" } },
          { id: "signing-bonus", name: "Signing bonus", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Signing bonus" } },
          { id: "relocation-bonus", name: "Relocation bonus", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Relocation bonus" } },
          { id: "retention-bonus", name: "Retention bonus", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Retention bonus" } },
          { id: "compensation-review-date", name: "Compensation review date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Compensation review date" } },
          { id: "last-raise-date", name: "Last raise date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Last raise date" } },
          { id: "last-raise-amount", name: "Last raise amount", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Last raise amount" } },
          { id: "next-review-date", name: "Next review date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Next review date" } },
          { id: "compensation-band", name: "Compensation band", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Compensation band" } },
          { id: "compensation-grade", name: "Compensation grade", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Compensation", field: "Compensation grade" } },
        ],
      },
      {
        id: "equity",
        name: "Equity",
        type: "category",
        children: [
          { id: "equity-grant-date", name: "Equity grant date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity grant date" } },
          { id: "equity-vesting-start", name: "Equity vesting start", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity vesting start" } },
          { id: "equity-vesting-end", name: "Equity vesting end", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity vesting end" } },
          { id: "equity-shares-granted", name: "Equity shares granted", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity shares granted" } },
          { id: "equity-shares-vested", name: "Equity shares vested", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity shares vested" } },
          { id: "equity-shares-unvested", name: "Equity shares unvested", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity shares unvested" } },
          { id: "equity-strike-price", name: "Equity strike price", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity strike price" } },
          { id: "equity-fair-value", name: "Equity fair value", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity fair value" } },
          { id: "equity-vesting-schedule", name: "Equity vesting schedule", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity vesting schedule" } },
          { id: "equity-vesting-cliff", name: "Equity vesting cliff", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity vesting cliff" } },
          { id: "equity-type", name: "Equity type", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity type" } },
          { id: "rsu-grant-amount", name: "RSU grant amount", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "RSU grant amount" } },
          { id: "rsu-vested-amount", name: "RSU vested amount", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "RSU vested amount" } },
          { id: "stock-options-granted", name: "Stock options granted", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Stock options granted" } },
          { id: "stock-options-exercised", name: "Stock options exercised", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Stock options exercised" } },
          { id: "stock-options-remaining", name: "Stock options remaining", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Stock options remaining" } },
          { id: "equity-value", name: "Equity value", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity value" } },
          { id: "equity-vested-value", name: "Equity vested value", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity vested value" } },
          { id: "equity-unvested-value", name: "Equity unvested value", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity unvested value" } },
          { id: "equity-exercise-date", name: "Equity exercise date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity exercise date" } },
          { id: "equity-expiration-date", name: "Equity expiration date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Equity", field: "Equity expiration date" } },
        ],
      },
      {
        id: "termination",
        name: "Termination",
        type: "category",
        children: [
          { id: "termination-date", name: "Termination date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination date" } },
          { id: "termination-reason", name: "Termination reason", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination reason" } },
          { id: "termination-type", name: "Termination type", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination type" } },
          { id: "termination-effective-date", name: "Termination effective date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination effective date" } },
          { id: "last-day-worked", name: "Last day worked", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Last day worked" } },
          { id: "termination-notice-date", name: "Termination notice date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination notice date" } },
          { id: "termination-severance", name: "Termination severance", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination severance" } },
          { id: "termination-severance-weeks", name: "Termination severance weeks", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination severance weeks" } },
          { id: "termination-accrued-pto", name: "Termination accrued PTO", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination accrued PTO" } },
          { id: "termination-pto-payout", name: "Termination PTO payout", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination PTO payout" } },
          { id: "termination-final-pay", name: "Termination final pay", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination final pay" } },
          { id: "termination-cobra-eligible", name: "Termination COBRA eligible", type: "field", fieldType: "boolean", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination COBRA eligible" } },
          { id: "termination-exit-interview", name: "Termination exit interview", type: "field", fieldType: "boolean", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination exit interview" } },
          { id: "termination-exit-interview-date", name: "Termination exit interview date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination exit interview date" } },
          { id: "termination-return-date", name: "Termination return date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination return date" } },
          { id: "termination-rehire-eligible", name: "Termination rehire eligible", type: "field", fieldType: "boolean", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination rehire eligible" } },
          { id: "termination-documentation", name: "Termination documentation", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination documentation" } },
          { id: "termination-approver", name: "Termination approver", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination approver" } },
          { id: "termination-approval-date", name: "Termination approval date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination approval date" } },
          { id: "termination-notes", name: "Termination notes", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Termination", field: "Termination notes" } },
        ],
      },
      {
        id: "dates",
        name: "Dates",
        type: "category",
        children: [
          { id: "hire-date", name: "Hire date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Hire date" } },
          { id: "start-date", name: "Start date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Start date" } },
          { id: "end-date", name: "End date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "End date" } },
          { id: "probation-end-date", name: "Probation end date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Probation end date" } },
          { id: "review-date", name: "Review date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Review date" } },
          { id: "next-review-date", name: "Next review date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Next review date" } },
          { id: "promotion-date", name: "Promotion date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Promotion date" } },
          { id: "transfer-date", name: "Transfer date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Transfer date" } },
          { id: "contract-start-date", name: "Contract start date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Contract start date" } },
          { id: "contract-end-date", name: "Contract end date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Contract end date" } },
          { id: "offer-date", name: "Offer date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Offer date" } },
          { id: "acceptance-date", name: "Acceptance date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Acceptance date" } },
          { id: "background-check-date", name: "Background check date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Background check date" } },
          { id: "onboarding-date", name: "Onboarding date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Onboarding date" } },
          { id: "orientation-date", name: "Orientation date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Orientation date" } },
          { id: "training-start-date", name: "Training start date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Training start date" } },
          { id: "training-end-date", name: "Training end date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Training end date" } },
          { id: "benefits-eligibility-date", name: "Benefits eligibility date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Benefits eligibility date" } },
          { id: "vesting-start-date", name: "Vesting start date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Vesting start date" } },
          { id: "vesting-cliff-date", name: "Vesting cliff date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Vesting cliff date" } },
          { id: "anniversary-date", name: "Anniversary date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Anniversary date" } },
          { id: "last-day-worked", name: "Last day worked", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Dates", field: "Last day worked" } },
        ],
      },
      {
        id: "insurance",
        name: "Insurance",
        type: "category",
        children: [
          { id: "health-insurance-provider", name: "Health insurance provider", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Health insurance provider" } },
          { id: "health-insurance-plan", name: "Health insurance plan", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Health insurance plan" } },
          { id: "health-insurance-coverage-start", name: "Health insurance coverage start", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Health insurance coverage start" } },
          { id: "health-insurance-coverage-end", name: "Health insurance coverage end", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Health insurance coverage end" } },
          { id: "dental-insurance-provider", name: "Dental insurance provider", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Dental insurance provider" } },
          { id: "dental-insurance-plan", name: "Dental insurance plan", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Dental insurance plan" } },
          { id: "vision-insurance-provider", name: "Vision insurance provider", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Vision insurance provider" } },
          { id: "vision-insurance-plan", name: "Vision insurance plan", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Vision insurance plan" } },
          { id: "life-insurance-amount", name: "Life insurance amount", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Life insurance amount" } },
          { id: "life-insurance-provider", name: "Life insurance provider", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Life insurance provider" } },
          { id: "disability-insurance-type", name: "Disability insurance type", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Disability insurance type" } },
          { id: "disability-insurance-amount", name: "Disability insurance amount", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Disability insurance amount" } },
          { id: "insurance-enrollment-date", name: "Insurance enrollment date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Insurance enrollment date" } },
          { id: "insurance-effective-date", name: "Insurance effective date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Insurance effective date" } },
          { id: "insurance-premium", name: "Insurance premium", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Insurance premium" } },
          { id: "insurance-deductible", name: "Insurance deductible", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Insurance deductible" } },
          { id: "insurance-co-pay", name: "Insurance co-pay", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Insurance co-pay" } },
          { id: "insurance-policy-number", name: "Insurance policy number", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Insurance policy number" } },
          { id: "insurance-group-number", name: "Insurance group number", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Insurance group number" } },
          { id: "insurance-beneficiary", name: "Insurance beneficiary", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "Insurance beneficiary" } },
          { id: "cobra-eligible", name: "COBRA eligible", type: "field", fieldType: "boolean", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "COBRA eligible" } },
          { id: "cobra-start-date", name: "COBRA start date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Insurance", field: "COBRA start date" } },
        ],
      },
      {
        id: "notice",
        name: "Notice",
        type: "category",
        children: [
          { id: "notice-period-days", name: "Notice period days", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice period days" } },
          { id: "notice-period-weeks", name: "Notice period weeks", type: "field", fieldType: "number", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice period weeks" } },
          { id: "notice-given-date", name: "Notice given date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice given date" } },
          { id: "notice-received-date", name: "Notice received date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice received date" } },
          { id: "notice-effective-date", name: "Notice effective date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice effective date" } },
          { id: "notice-type", name: "Notice type", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice type" } },
          { id: "notice-reason", name: "Notice reason", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice reason" } },
          { id: "notice-method", name: "Notice method", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice method" } },
          { id: "notice-acknowledged", name: "Notice acknowledged", type: "field", fieldType: "boolean", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice acknowledged" } },
          { id: "notice-acknowledgment-date", name: "Notice acknowledgment date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice acknowledgment date" } },
          { id: "resignation-date", name: "Resignation date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Resignation date" } },
          { id: "resignation-accepted-date", name: "Resignation accepted date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Resignation accepted date" } },
          { id: "termination-notice-date", name: "Termination notice date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Termination notice date" } },
          { id: "layoff-notice-date", name: "Layoff notice date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Layoff notice date" } },
          { id: "warn-notice-date", name: "WARN notice date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "WARN notice date" } },
          { id: "warn-notice-required", name: "WARN notice required", type: "field", fieldType: "boolean", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "WARN notice required" } },
          { id: "notice-documentation", name: "Notice documentation", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice documentation" } },
          { id: "notice-approver", name: "Notice approver", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice approver" } },
          { id: "notice-approval-date", name: "Notice approval date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice approval date" } },
          { id: "notice-follow-up-date", name: "Notice follow-up date", type: "field", fieldType: "date", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice follow-up date" } },
          { id: "notice-notes", name: "Notice notes", type: "field", fieldType: "string", path: { step: "document-custom-variables", object: "Document custom variables", category: "Notice", field: "Notice notes" } },
        ],
      },
    ],
  };

  // Helper function to recursively update paths in a node tree
  const updatePaths = (node: VariableNode, newStep: string): VariableNode => {
    const updatedNode = JSON.parse(JSON.stringify(node)); // Deep clone
    
    if (updatedNode.path) {
      updatedNode.path = {
        ...updatedNode.path,
        step: newStep,
      };
    }
    
    if (updatedNode.children) {
      updatedNode.children = updatedNode.children.map((child: VariableNode) => updatePaths(child, newStep));
    }
    
    return updatedNode;
  };

  // Return array with Employee and Document custom variables
  const result: VariableNode[] = [];
  if (employeeObject) {
    // Update all paths in Employee object to use "employee" as the step (matching the object id)
    // This ensures the VariableDropdown's filtering logic works correctly
    // The currentStep will be set to "employee" (the object's id), and fields need path.step to match
    const updatedEmployee = updatePaths(employeeObject, "employee");
    result.push(updatedEmployee);
  }
  
  // Add Document custom variables
  // Don't flatten documentCustomVariables - we want to preserve the category structure
  // even if categories only have one field, so users can see all the categories
  // Update paths to use "document-custom-variables" as the step (matching the object id)
  const updatedDocumentCustomVariables = updatePaths(documentCustomVariables, "document-custom-variables");
  result.push(updatedDocumentCustomVariables);
  
  return result;
}

// Get available steps for a given current step
export function getAvailableSteps(
  currentStep: SelectedNode,
  outputFormat?: string,
  jsonProperties?: Array<{ name: string; type: string; description: string }>,
  showChangeStates?: boolean
): VariableNode[] {
  const steps: VariableNode[] = [flattenVariableTree(generateTriggerVariables(showChangeStates))];

  if (currentStep === "sms") {
    steps.push(flattenVariableTree(generateAIPromptVariables(outputFormat || "Text", jsonProperties)));
  }

  return steps;
}

export type SelectedNode = "trigger" | "aiPrompt" | "sms";

