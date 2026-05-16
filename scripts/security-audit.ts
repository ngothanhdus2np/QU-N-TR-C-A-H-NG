#!/usr/bin/env tsx
/**
 * Security Audit Script
 * 
 * Chạy các kiểm tra security cơ bản cho CFO Brain 4.0
 * 
 * Usage: npm run security:audit
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🔒 CFO Brain 4.0 - Security Audit\n');
console.log('='.repeat(50));

let issuesFound = 0;

// 1. Check npm dependencies for vulnerabilities
console.log('\n📦 1. Checking npm dependencies...');
try {
  execSync('npm audit --audit-level=moderate', { stdio: 'inherit' });
  console.log('✅ No moderate+ vulnerabilities found');
} catch (err) {
  console.error('⚠️  Found vulnerabilities - run `npm audit fix`');
  issuesFound++;
}

// 2. Check for hardcoded secrets
console.log('\n🔑 2. Checking for hardcoded secrets...');
const secretPatterns = [
  'apiKey\\s*=\\s*["\']',
  'API_KEY\\s*=\\s*["\']',
  'secret\\s*=\\s*["\']',
  'SECRET\\s*=\\s*["\']',
  'password\\s*=\\s*["\']',
  'PASSWORD\\s*=\\s*["\']',
  'token\\s*=\\s*["\']',
  'TOKEN\\s*=\\s*["\']',
];

let foundSecrets = false;
for (const pattern of secretPatterns) {
  try {
    execSync(
      `grep -r "${pattern}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build . || true`,
      { stdio: 'pipe' }
    );
  } catch (err: any) {
    if (err.stdout && err.stdout.toString().trim()) {
      foundSecrets = true;
      console.log(`⚠️  Found potential hardcoded secret: ${pattern}`);
      console.log(err.stdout.toString());
    }
  }
}

if (!foundSecrets) {
  console.log('✅ No hardcoded secrets found');
} else {
  issuesFound++;
}

// 3. Check .env.local is in .gitignore
console.log('\n🙈 3. Checking .gitignore...');
const gitignorePath = join(process.cwd(), '.gitignore');
if (existsSync(gitignorePath)) {
  const gitignore = readFileSync(gitignorePath, 'utf8');
  const requiredEntries = ['.env.local', '.env', 'node_modules'];
  const missing = requiredEntries.filter(entry => !gitignore.includes(entry));
  
  if (missing.length === 0) {
    console.log('✅ .gitignore is properly configured');
  } else {
    console.log(`⚠️  Missing in .gitignore: ${missing.join(', ')}`);
    issuesFound++;
  }
} else {
  console.log('❌ .gitignore not found!');
  issuesFound++;
}

// 4. Check .env.example exists
console.log('\n📝 4. Checking .env.example...');
const envExamplePath = join(process.cwd(), '.env.example');
if (existsSync(envExamplePath)) {
  console.log('✅ .env.example exists');
} else {
  console.log('⚠️  .env.example not found - create one for documentation');
  issuesFound++;
}

// 5. Check for security packages
console.log('\n🛡️  5. Checking security packages...');
const packageJsonPath = join(process.cwd(), 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const securityPackages = {
    'helmet': 'Security headers',
    'express-rate-limit': 'Rate limiting',
    'csurf': 'CSRF protection',
    '@sentry/node': 'Error tracking',
    'winston': 'Structured logging',
  };
  
  for (const [pkg, description] of Object.entries(securityPackages)) {
    if (deps[pkg]) {
      console.log(`✅ ${pkg} (${description}) - installed`);
    } else {
      console.log(`⚠️  ${pkg} (${description}) - not installed`);
    }
  }
}

// 6. Check TypeScript strict mode
console.log('\n📘 6. Checking TypeScript configuration...');
const tsconfigPath = join(process.cwd(), 'tsconfig.json');
if (existsSync(tsconfigPath)) {
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
  const strict = tsconfig.compilerOptions?.strict;
  
  if (strict) {
    console.log('✅ TypeScript strict mode enabled');
  } else {
    console.log('⚠️  TypeScript strict mode not enabled');
    issuesFound++;
  }
}

// 7. Check for HTTPS in production
console.log('\n🔐 7. Checking HTTPS configuration...');
const serverPath = join(process.cwd(), 'server.ts');
if (existsSync(serverPath)) {
  const serverContent = readFileSync(serverPath, 'utf8');
  
  if (serverContent.includes('secure: true') || serverContent.includes('https')) {
    console.log('✅ HTTPS configuration found');
  } else {
    console.log('⚠️  Ensure HTTPS is enabled in production');
  }
}

// 8. Check for rate limiting
console.log('\n⏱️  8. Checking rate limiting...');
if (existsSync(serverPath)) {
  const serverContent = readFileSync(serverPath, 'utf8');
  
  if (serverContent.includes('rateLimit') || serverContent.includes('rate-limit')) {
    console.log('✅ Rate limiting configured');
  } else {
    console.log('⚠️  Rate limiting not found - consider adding express-rate-limit');
    issuesFound++;
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('\n📊 AUDIT SUMMARY\n');

if (issuesFound === 0) {
  console.log('✅ All security checks passed!');
  console.log('🎉 Your application has good security posture.');
} else {
  console.log(`⚠️  Found ${issuesFound} potential security issues.`);
  console.log('📖 Review the findings above and address them.');
}

console.log('\n💡 RECOMMENDATIONS:');
console.log('   1. Run `npm audit fix` regularly');
console.log('   2. Keep dependencies up to date');
console.log('   3. Review SECURITY_AUDIT_REPORT.md for detailed recommendations');
console.log('   4. Enable Sentry for production error tracking');
console.log('   5. Implement CSRF protection for state-changing operations');

console.log('\n✅ Security audit complete\n');

process.exit(issuesFound > 0 ? 1 : 0);
