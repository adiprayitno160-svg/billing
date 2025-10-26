# 🤝 Contributing to Billing System

Thank you for considering contributing to Billing System! We welcome contributions from the community.

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [How Can I Contribute?](#-how-can-i-contribute)
- [Development Setup](#-development-setup)
- [Coding Guidelines](#-coding-guidelines)
- [Commit Guidelines](#-commit-guidelines)
- [Pull Request Process](#-pull-request-process)
- [Reporting Bugs](#-reporting-bugs)
- [Suggesting Features](#-suggesting-features)

---

## 📜 Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow:

### Our Pledge

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discriminatory language
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information
- Other unprofessional conduct

---

## 🎯 How Can I Contribute?

### 1. Reporting Bugs

Found a bug? Please help us by:

1. **Check existing issues** - Maybe it's already reported
2. **Create detailed report** - Include:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Environment details (OS, Node version, etc.)

**Bug Report Template:**
```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: Ubuntu 22.04
- Node: v18.19.0
- Browser: Chrome 120
- Version: 1.0.0

## Screenshots
If applicable, add screenshots
```

### 2. Suggesting Features

Have an idea? We'd love to hear it!

1. **Check existing feature requests**
2. **Open new issue** with label `enhancement`
3. **Describe the feature**:
   - Use case
   - Expected behavior
   - Why it's useful
   - Mockups/examples (if applicable)

**Feature Request Template:**
```markdown
## Feature Description
Clear description of the feature

## Use Case
Who needs this and why?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you've thought about

## Additional Context
Any other relevant information
```

### 3. Improving Documentation

Documentation improvements are always welcome:

- Fix typos or grammar
- Add missing documentation
- Improve existing guides
- Add code examples
- Translate to other languages

### 4. Code Contributions

Ready to code? Great!

1. **Find an issue** to work on (or create one)
2. **Comment on the issue** to let others know you're working on it
3. **Fork and create branch**
4. **Write code** following our guidelines
5. **Test thoroughly**
6. **Submit pull request**

---

## 🛠️ Development Setup

### Prerequisites

```bash
# Required
- Node.js 18.x LTS
- MySQL 8.0+ or MariaDB 10.5+
- Git

# Recommended
- VS Code with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
```

### Setup Steps

1. **Fork the repository**

Click "Fork" button on GitHub

2. **Clone your fork**

```bash
git clone https://github.com/YOUR_USERNAME/billing.git
cd billing
```

3. **Add upstream remote**

```bash
git remote add upstream https://github.com/adiprayitno160-svg/billing.git
```

4. **Install dependencies**

```bash
npm install
```

5. **Create database**

```bash
mysql -u root -p << EOF
CREATE DATABASE billing_system_dev;
CREATE USER 'dev_user'@'localhost' IDENTIFIED BY 'dev_password';
GRANT ALL PRIVILEGES ON billing_system_dev.* TO 'dev_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

6. **Configure environment**

```bash
cp .env.example .env
nano .env

# Update with your dev settings:
# DB_NAME=billing_system_dev
# DB_USER=dev_user
# DB_PASSWORD=dev_password
# NODE_ENV=development
```

7. **Build and run**

```bash
# Build TypeScript
npm run build

# Start in development mode
npm run dev

# Or start normally
npm start
```

8. **Verify setup**

Open browser: `http://localhost:3000`

Default login:
- Username: `admin`
- Password: `admin123`

---

## 📝 Coding Guidelines

### TypeScript Style

```typescript
// Use TypeScript for type safety
interface Customer {
  id: number;
  name: string;
  email: string;
  phone?: string; // Optional with ?
}

// Use async/await, not callbacks
async function getCustomer(id: number): Promise<Customer> {
  const result = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
  return result[0];
}

// Use descriptive names
// ✅ Good
const activeCustomers = await getActiveCustomers();

// ❌ Bad
const c = await get();
```

### File Structure

```
src/
├── controllers/     # Route handlers
├── services/        # Business logic
├── middlewares/     # Express middlewares
├── routes/          # Route definitions
├── db/             # Database connection
├── utils/          # Utility functions
└── types/          # TypeScript types
```

### Naming Conventions

```typescript
// Files: camelCase.ts
customerController.ts
authService.ts

// Classes: PascalCase
class CustomerService {}
class DatabasePool {}

// Functions: camelCase
function calculateTotal() {}
async function fetchCustomers() {}

// Variables: camelCase
const customerName = 'John';
let totalAmount = 0;

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const API_BASE_URL = 'https://api.example.com';

// Interfaces: PascalCase with I prefix (optional)
interface ICustomer {}
interface Customer {} // Also acceptable
```

### Code Quality

```typescript
// 1. Use meaningful variable names
// ✅ Good
const customerEmail = customer.email;

// ❌ Bad
const e = customer.email;

// 2. Keep functions small and focused
// ✅ Good - does one thing
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ❌ Bad - does too many things
function processCustomer(data: any) {
  // validates, saves, sends email, logs, etc.
}

// 3. Add comments for complex logic
// ✅ Good
// Calculate prorated amount based on remaining days in month
const proratedAmount = (monthlyPrice / daysInMonth) * remainingDays;

// 4. Handle errors properly
// ✅ Good
try {
  await saveCustomer(customer);
} catch (error) {
  console.error('Failed to save customer:', error);
  throw new Error('Customer save failed');
}

// 5. Use const by default
// ✅ Good
const customers = await getCustomers();

// Only use let when reassignment needed
let total = 0;
for (const item of items) {
  total += item.price;
}
```

### Database Queries

```typescript
// Use parameterized queries to prevent SQL injection
// ✅ Good
const customer = await db.query(
  'SELECT * FROM customers WHERE id = ?',
  [customerId]
);

// ❌ Bad - SQL injection risk!
const customer = await db.query(
  `SELECT * FROM customers WHERE id = ${customerId}`
);

// Use transactions for multiple related queries
// ✅ Good
const connection = await db.getConnection();
await connection.beginTransaction();

try {
  await connection.query('INSERT INTO invoices ...');
  await connection.query('UPDATE customers ...');
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

### Security

```typescript
// Never commit sensitive data
// ✅ Good - use environment variables
const apiKey = process.env.API_KEY;

// ❌ Bad - hardcoded secrets
const apiKey = 'sk_live_abc123';

// Validate all user input
// ✅ Good
if (!email || !validateEmail(email)) {
  throw new Error('Invalid email');
}

// Sanitize output
// ✅ Good
const safeHtml = escapeHtml(userInput);
```

---

## 📝 Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding tests
- **chore**: Maintenance tasks

### Examples

```bash
# Good commits
feat(customer): add customer export to Excel
fix(billing): correct invoice calculation for prorated amounts
docs(readme): update installation instructions
refactor(auth): simplify login flow
perf(database): optimize customer query

# Bad commits
fix bug
update stuff
changes
```

### Detailed Example

```bash
feat(payment): add Midtrans payment gateway integration

- Add Midtrans API client
- Implement payment creation
- Handle payment callbacks
- Add payment status sync
- Update invoice status on successful payment

Closes #123
```

---

## 🔄 Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Self-review of code completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if needed)
- [ ] No console.log() left in code
- [ ] Tests pass (if applicable)
- [ ] Builds successfully

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issue
Closes #(issue number)

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
How did you test this?

## Screenshots
If applicable

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No breaking changes
```

### Submission Steps

1. **Update your fork**

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

2. **Create feature branch**

```bash
git checkout -b feature/your-feature-name
```

3. **Make changes and commit**

```bash
git add .
git commit -m "feat(scope): your commit message"
```

4. **Push to your fork**

```bash
git push origin feature/your-feature-name
```

5. **Create Pull Request**

- Go to your fork on GitHub
- Click "New Pull Request"
- Select your feature branch
- Fill in PR template
- Submit!

### Review Process

1. **Automated checks** run first
2. **Maintainer reviews** your code
3. **Changes requested** (if needed)
4. **Approval** and merge

### After Merge

```bash
# Update your local main
git checkout main
git pull upstream main

# Delete feature branch
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

---

## 🐛 Reporting Bugs

### Security Vulnerabilities

**DO NOT** open public issue for security vulnerabilities.

Instead:
- Email: security@example.com
- Include detailed description
- Steps to reproduce
- Potential impact

### Regular Bugs

Use GitHub Issues with the "bug" label.

Include:
1. Clear title
2. Detailed description
3. Steps to reproduce
4. Expected behavior
5. Actual behavior
6. Environment details
7. Screenshots/logs

---

## 💡 Suggesting Features

We love feature suggestions!

### Good Feature Requests Include:

1. **Clear use case** - Why is this needed?
2. **Detailed description** - What should it do?
3. **User benefit** - How does this help users?
4. **Implementation ideas** - (Optional) How could it work?
5. **Examples** - Similar features in other apps

### Feature Request Process

1. Check if similar feature requested
2. Open issue with "enhancement" label
3. Discuss with community
4. Maintainers review and prioritize
5. Implementation (by you or others!)

---

## 🌍 Translation

Help translate Billing System!

### Available Languages

- 🇬🇧 English (Primary)
- 🇮🇩 Indonesian (Need help!)
- 🇯🇵 Japanese (Need help!)
- 🇨🇳 Chinese (Need help!)

### Translation Process

1. Copy `locales/en.json`
2. Create `locales/YOUR_LANG.json`
3. Translate all strings
4. Test thoroughly
5. Submit PR

---

## ❓ Questions?

### Ask Questions

- 💬 GitHub Discussions
- 🐛 GitHub Issues (for bug-related questions)
- 📧 Email: support@example.com

### Getting Help

Before asking:
1. Read documentation
2. Search existing issues
3. Try troubleshooting guide

When asking:
- Be specific
- Include context
- Show what you tried
- Be patient and respectful

---

## 🎉 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in documentation

### Hall of Fame

Top contributors get special recognition!

---

## 📞 Contact

- **Email**: support@example.com
- **GitHub**: [@adiprayitno160-svg](https://github.com/adiprayitno160-svg)
- **Twitter**: [@billing_system](https://twitter.com/billing_system)

---

**Thank you for contributing! 🙏**

Every contribution, no matter how small, makes a difference.

[← Back to README](./README_INSTALLATION.md)

