# Design: System Bug Audit

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Bug Audit System                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │   CLI Tool   │─────▶│  Core Engine │─────▶│  Reports  │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│                               │                              │
│                               ▼                              │
│         ┌────────────────────────────────────┐              │
│         │        Scanner Modules             │              │
│         ├────────────────────────────────────┤              │
│         │ • Logic Scanner                    │              │
│         │ • Security Scanner                 │              │
│         │ • Performance Scanner              │              │
│         │ • UI/UX Scanner                    │              │
│         │ • Data Integrity Scanner           │              │
│         │ • Error Handling Scanner           │              │
│         └────────────────────────────────────┘              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Breakdown

**CLI Tool** (`/tools/audit/cli.ts`)
- Entry point cho audit commands
- Parse command line arguments
- Orchestrate scan workflow
- Display progress và results

**Core Engine** (`/tools/audit/engine/`)
- File discovery và filtering
- Parallel processing coordinator
- Result aggregation
- Severity scoring engine
- Report generation

**Scanner Modules** (`/tools/audit/scanners/`)
- Mỗi scanner là independent module
- Implement common interface `IScanner`
- Stateless design để support parallel execution

**Report Generator** (`/tools/audit/reporters/`)
- Markdown formatter
- JSON exporter
- HTML dashboard generator

---

## 2. Technical Design

### 2.1 Core Interfaces

```typescript
// tools/audit/types.ts

interface IScanner {
  name: string;
  category: BugCategory;
  scan(file: FileInfo): Promise<Bug[]>;
}

interface Bug {
  id: string; // Format: BUG-{CATEGORY}-{NUMBER}
  category: BugCategory;
  severity: Severity;
  file: string;
  line?: number;
  title: string;
  description: string;
  impact: Impact;
  suggestedFix: string;
  codeSnippet?: string;
  status: BugStatus;
  discoveredAt: Date;
}

enum BugCategory {
  LOGIC = 'LOGIC',
  SECURITY = 'SEC',
  PERFORMANCE = 'PERF',
  UX = 'UX',
  DATA = 'DATA',
  ERROR = 'ERR'
}

enum Severity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

interface Impact {
  dataImpact: 0 | 1 | 2 | 3;
  userImpact: 0 | 1 | 2 | 3;
  frequency: 0 | 1 | 2 | 3;
  totalScore: number; // 0-9
}

enum BugStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  FIXED = 'FIXED',
  DEFERRED = 'DEFERRED',
  NEED_DISCUSSION = 'NEED_DISCUSSION'
}

interface FileInfo {
  path: string;
  content: string;
  ast?: any; // TypeScript AST
  lastModified: Date;
}

interface AuditConfig {
  exclude: string[];
  severityThreshold: Severity;
  maxBugsPerFile: number;
  enableAutoFix: boolean;
  parallel: number; // Number of parallel scanners
}

interface AuditResult {
  totalBugs: number;
  byCategory: Record<BugCategory, number>;
  bySeverity: Record<Severity, number>;
  bugs: Bug[];
  executionTime: number;
  scannedFiles: number;
}
```

### 2.2 Scanner Implementation Pattern

```typescript
// tools/audit/scanners/LogicScanner.ts

export class LogicScanner implements IScanner {
  name = 'Logic Business Scanner';
  category = BugCategory.LOGIC;

  async scan(file: FileInfo): Promise<Bug[]> {
    const bugs: Bug[] = [];
    
    // Race condition detection
    bugs.push(...this.detectRaceConditions(file));
    
    // Data validation gaps
    bugs.push(...this.detectValidationGaps(file));
    
    // State management issues
    bugs.push(...this.detectStateIssues(file));
    
    return bugs;
  }

  private detectRaceConditions(file: FileInfo): Bug[] {
    // Pattern: Multiple async calls without proper sequencing
    const racePatterns = [
      /await.*Promise\.all.*setState/g,
      /setState.*setState/g, // Rapid setState
    ];
    
    // Implementation...
    return [];
  }

  private detectValidationGaps(file: FileInfo): Bug[] {
    // Look for user inputs without validation
    // Check: TextInput without validation prop
    // Check: API calls without input sanitization
    return [];
  }
}
```

---

## 3. Scanning Strategies

### 3.1 Pattern-Based Detection

**Approach**: Use regex patterns + AST analysis to detect common bug patterns.

**Examples**:

```typescript
// Security Scanner - SQL Injection Detection
const sqlInjectionPatterns = [
  /supabase\.from\(.*\$\{.*\}\)/g,  // Template literals in queries
  /\.eq\(['"].*\$\{/g,                // Dynamic column names
];

// Performance Scanner - N+1 Detection
const n1Patterns = [
  /for.*await.*supabase\.from/gs,   // Query inside loop
  /map.*await.*fetch/gs,             // API call in map
];

// UI/UX Scanner - Missing Loading State
const loadingStatePatterns = [
  /async.*onPress.*fetch/,           // Async onPress without loading state
  /useEffect.*fetch.*\[\]/,          // Data fetch without loading indicator
];
```

### 3.2 AST-Based Analysis

**Approach**: Parse TypeScript/JavaScript code into AST để deep analysis.

**Use Cases**:
- Detect unused state variables
- Find unhandled promise rejections
- Identify missing error boundaries
- Track data flow for validation gaps

**Tools**: 
- `@typescript-eslint/parser` - Parse TS/JS to AST
- `@typescript-eslint/typescript-estree` - Type-aware analysis

**Example**:

```typescript
import { parse } from '@typescript-eslint/typescript-estree';

function analyzeStateUsage(file: FileInfo): Bug[] {
  const ast = parse(file.content, { loc: true });
  const bugs: Bug[] = [];
  
  // Find useState declarations
  const stateVars = findStateDeclarations(ast);
  
  // Check if each state is actually used
  for (const stateVar of stateVars) {
    if (!isStateUsed(ast, stateVar.name)) {
      bugs.push({
        id: generateBugId('LOGIC'),
        category: BugCategory.LOGIC,
        severity: Severity.LOW,
        file: file.path,
        line: stateVar.line,
        title: 'Unused State Variable',
        description: `State "${stateVar.name}" is declared but never used`,
        impact: calculateImpact(0, 0, 1), // Low impact
        suggestedFix: `Remove unused state or implement its usage`,
        status: BugStatus.OPEN,
        discoveredAt: new Date()
      });
    }
  }
  
  return bugs;
}
```

### 3.3 Context-Aware Analysis

**Approach**: Understand project context để reduce false positives.

**Context Sources**:
- `package.json` - Dependencies, scripts
- `tsconfig.json` - TypeScript config
- `.env.example` - Environment variables
- Database schema files
- API documentation

**Example**: If project uses `react-query`, don't flag queries in loops as N+1 (since react-query handles caching).

---

## 4. Severity Scoring Algorithm

### 4.1 Scoring Function

```typescript
function calculateSeverity(
  dataImpact: 0 | 1 | 2 | 3,
  userImpact: 0 | 1 | 2 | 3,
  frequency: 0 | 1 | 2 | 3,
  context?: { category: BugCategory; keywords: string[] }
): Severity {
  let score = dataImpact + userImpact + frequency;
  
  // Critical override rules
  if (context) {
    if (context.category === BugCategory.SECURITY) {
      score = Math.max(score, 5); // Minimum High for security
    }
    
    if (context.keywords.includes('data loss') || 
        context.keywords.includes('corruption')) {
      score = Math.max(score, 7); // Minimum Critical
    }
    
    if (context.keywords.includes('crash') || 
        context.keywords.includes('fatal')) {
      score = Math.max(score, 5); // Minimum High
    }
  }
  
  // Map score to severity
  if (score >= 7) return Severity.CRITICAL;
  if (score >= 5) return Severity.HIGH;
  if (score >= 3) return Severity.MEDIUM;
  return Severity.LOW;
}

function calculateImpact(
  dataImpact: 0 | 1 | 2 | 3,
  userImpact: 0 | 1 | 2 | 3,
  frequency: 0 | 1 | 2 | 3
): Impact {
  return {
    dataImpact,
    userImpact,
    frequency,
    totalScore: dataImpact + userImpact + frequency
  };
}
```

---

## 5. Report Generation

### 5.1 Markdown Report Structure

```markdown
# 🐛 BUG AUDIT REPORT

**Project**: CFO Brain 4.0
**Audit Date**: 2026-06-23
**Audit Scope**: Full Codebase
**Auditor**: System Bug Audit Tool
**Version**: 1.0.0

## 📊 Summary

- **Total Bugs**: 47
- 🔴 **Critical**: 3
- 🟠 **High**: 12
- 🟡 **Medium**: 18
- 🟢 **Low**: 14

## 📑 Table of Contents

1. [Logic Nghiệp vụ](#1-logic-nghiệp-vụ) (15 bugs)
2. [Bảo mật](#2-bảo-mật) (8 bugs)
3. [Hiệu năng](#3-hiệu-năng) (12 bugs)
4. [UI/UX](#4-uiux) (7 bugs)
5. [Data Integrity](#5-data-integrity) (3 bugs)
6. [Error Handling](#6-error-handling) (2 bugs)

---

## 1. Logic Nghiệp vụ

### 1.1 🔴 Critical

#### 🔴 BUG-LOGIC-001

**File**: `services/posOrderService.ts:145`
**Category**: Logic Nghiệp vụ
**Discovered**: 2026-06-23
**Status**: ❌ Open

**Description**:
Race condition trong payment processing. Khi user click thanh toán nhanh nhiều lần, system tạo multiple orders cho cùng 1 giỏ hàng.

**Impact**:
- Data Impact: 3 (High) - Tạo duplicate orders, financial loss
- User Impact: 3 (High) - User bị charge nhiều lần
- Frequency: 2 (Medium) - Xảy ra khi network slow + user impatient
- **Severity Score: 8 (Critical)**

**How to Reproduce**:
1. Add products to cart
2. Go to payment screen
3. Click "Thanh Toán" rapidly 3-4 times
4. Check database - multiple orders created

**Suggested Fix**:
Add debounce to payment button and disable after first click:

```typescript
const [isProcessing, setIsProcessing] = useState(false);

const handlePayment = async () => {
  if (isProcessing) return; // Guard clause
  setIsProcessing(true);
  
  try {
    await processPayment();
  } finally {
    setIsProcessing(false);
  }
};
```

---

(More bugs follow same template...)
```

### 5.2 Report Generator Implementation

```typescript
// tools/audit/reporters/MarkdownReporter.ts

export class MarkdownReporter {
  generate(result: AuditResult): string {
    let report = this.generateHeader(result);
    report += this.generateSummary(result);
    report += this.generateTOC(result);
    
    for (const category of Object.values(BugCategory)) {
      const bugs = result.bugs.filter(b => b.category === category);
      if (bugs.length > 0) {
        report += this.generateCategorySection(category, bugs);
      }
    }
    
    return report;
  }

  private generateBugEntry(bug: Bug): string {
    const severityEmoji = this.getSeverityEmoji(bug.severity);
    const statusEmoji = this.getStatusEmoji(bug.status);
    
    return `
#### ${severityEmoji} ${bug.id}

**File**: \`${bug.file}${bug.line ? ':' + bug.line : ''}\`
**Category**: ${bug.category}
**Discovered**: ${bug.discoveredAt.toISOString().split('T')[0]}
**Status**: ${statusEmoji} ${bug.status}

**Description**:
${bug.description}

**Impact**:
- Data Impact: ${bug.impact.dataImpact} (${this.getImpactLabel(bug.impact.dataImpact)})
- User Impact: ${bug.impact.userImpact} (${this.getImpactLabel(bug.impact.userImpact)})
- Frequency: ${bug.impact.frequency} (${this.getImpactLabel(bug.impact.frequency)})
- **Severity Score: ${bug.impact.totalScore} (${bug.severity})**

**Suggested Fix**:
${bug.suggestedFix}

${bug.codeSnippet ? '**Code Snippet**:\n```typescript\n' + bug.codeSnippet + '\n```\n' : ''}

---
`;
  }
}
```

---

## 6. Workflow Implementation

### 6.1 CLI Entry Point

```typescript
// tools/audit/cli.ts

import { Command } from 'commander';
import { AuditEngine } from './engine/AuditEngine';
import { loadConfig } from './config';

const program = new Command();

program
  .name('audit')
  .description('CFO Brain Bug Audit Tool')
  .version('1.0.0');

program
  .command('full')
  .description('Run full codebase audit')
  .option('-o, --output <path>', 'Output file path', './BUG_REPORT.md')
  .action(async (options) => {
    const config = await loadConfig();
    const engine = new AuditEngine(config);
    
    console.log('🔍 Starting full audit...');
    const result = await engine.runFullAudit();
    
    await engine.generateReport(result, options.output);
    console.log(`✅ Audit complete! Report: ${options.output}`);
  });

program
  .command('quick')
  .description('Quick scan (Critical + High only)')
  .action(async () => {
    const config = await loadConfig();
    config.severityThreshold = Severity.HIGH;
    
    const engine = new AuditEngine(config);
    console.log('⚡ Starting quick scan...');
    const result = await engine.runFullAudit();
    
    await engine.generateReport(result, './BUG_REPORT_QUICK.md');
  });

program
  .command('category <category>')
  .description('Scan specific category')
  .action(async (category) => {
    const engine = new AuditEngine(await loadConfig());
    const result = await engine.runCategoryAudit(category as BugCategory);
    
    await engine.generateReport(result, `./BUG_REPORT_${category}.md`);
  });

program
  .command('file <filepath>')
  .description('Scan single file')
  .action(async (filepath) => {
    const engine = new AuditEngine(await loadConfig());
    const result = await engine.runFileAudit(filepath);
    
    console.log(`Found ${result.totalBugs} bugs in ${filepath}`);
    result.bugs.forEach(bug => {
      console.log(`  ${bug.severity} - ${bug.title}`);
    });
  });

program.parse();
```

### 6.2 Core Engine

```typescript
// tools/audit/engine/AuditEngine.ts

import { glob } from 'glob';
import fs from 'fs/promises';
import pLimit from 'p-limit';

export class AuditEngine {
  private scanners: IScanner[];
  private config: AuditConfig;
  
  constructor(config: AuditConfig) {
    this.config = config;
    this.scanners = this.loadScanners();
  }
  
  async runFullAudit(): Promise<AuditResult> {
    const startTime = Date.now();
    
    // Discover files
    const files = await this.discoverFiles();
    console.log(`📁 Found ${files.length} files to scan`);
    
    // Scan files in parallel
    const limit = pLimit(this.config.parallel);
    const allBugs: Bug[] = [];
    
    let completed = 0;
    const tasks = files.map(file => 
      limit(async () => {
        const bugs = await this.scanFile(file);
        allBugs.push(...bugs);
        
        completed++;
        this.logProgress(completed, files.length, allBugs.length);
        
        return bugs;
      })
    );
    
    await Promise.all(tasks);
    
    const executionTime = Date.now() - startTime;
    
    return this.buildResult(allBugs, files.length, executionTime);
  }
  
  private async scanFile(filepath: string): Promise<Bug[]> {
    const content = await fs.readFile(filepath, 'utf-8');
    const fileInfo: FileInfo = {
      path: filepath,
      content,
      lastModified: (await fs.stat(filepath)).mtime
    };
    
    const bugs: Bug[] = [];
    
    for (const scanner of this.scanners) {
      try {
        const found = await scanner.scan(fileInfo);
        bugs.push(...found);
      } catch (error) {
        console.error(`Error in ${scanner.name} for ${filepath}:`, error);
      }
    }
    
    // Apply max bugs per file limit
    return bugs.slice(0, this.config.maxBugsPerFile);
  }
  
  private async discoverFiles(): Promise<string[]> {
    const patterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx'
    ];
    
    const files = await glob(patterns, {
      ignore: this.config.exclude
    });
    
    return files;
  }
  
  private logProgress(completed: number, total: number, bugsFound: number) {
    const percentage = Math.floor((completed / total) * 100);
    console.log(
      `✅ Completed: ${completed}/${total} (${percentage}%) | 🐛 Found: ${bugsFound} bugs`
    );
  }
}
```

---

## 7. File Organization

```
/tools/audit/
├── cli.ts                    # CLI entry point
├── config.ts                 # Config loader
├── types.ts                  # TypeScript interfaces
├── engine/
│   ├── AuditEngine.ts        # Core orchestration
│   ├── FileDiscovery.ts      # File finding logic
│   └── SeverityCalculator.ts # Scoring logic
├── scanners/
│   ├── IScanner.ts           # Scanner interface
│   ├── LogicScanner.ts
│   ├── SecurityScanner.ts
│   ├── PerformanceScanner.ts
│   ├── UXScanner.ts
│   ├── DataIntegrityScanner.ts
│   └── ErrorHandlingScanner.ts
├── reporters/
│   ├── MarkdownReporter.ts
│   ├── JsonReporter.ts
│   └── HtmlReporter.ts
└── utils/
    ├── AstParser.ts          # AST utilities
    ├── PatternMatcher.ts     # Regex pattern matching
    └── BugIdGenerator.ts     # Unique ID generation


/
├── BUG_REPORT.md             # Generated report
├── audit.config.json         # User config
└── package.json              # Add scripts:
                              #   "audit": "tsx tools/audit/cli.ts full"
                              #   "audit:quick": "tsx tools/audit/cli.ts quick"
```

---

## 8. Dependencies

```json
{
  "devDependencies": {
    "@typescript-eslint/parser": "^6.0.0",
    "@typescript-eslint/typescript-estree": "^6.0.0",
    "commander": "^11.0.0",
    "glob": "^10.0.0",
    "p-limit": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

---

## 9. Configuration File Format

```json
{
  "exclude": [
    "node_modules/**",
    "build/**",
    "dist/**",
    "**/*.test.ts",
    "**/*.spec.ts",
    ".git/**"
  ],
  "severityThreshold": "LOW",
  "maxBugsPerFile": 20,
  "enableAutoFix": false,
  "parallel": 4,
  "scanners": {
    "logic": { "enabled": true },
    "security": { "enabled": true },
    "performance": { "enabled": true },
    "ux": { "enabled": true },
    "data": { "enabled": true },
    "error": { "enabled": true }
  }
}
```

---

## 10. Implementation Phases

### Phase 1: Core Foundation (Week 1)
- [ ] Setup project structure
- [ ] Implement core interfaces
- [ ] Build CLI skeleton
- [ ] Create config loader
- [ ] Implement file discovery

### Phase 2: Basic Scanners (Week 2)
- [ ] LogicScanner (basic patterns)
- [ ] SecurityScanner (common vulnerabilities)
- [ ] PerformanceScanner (N+1, large bundles)
- [ ] Severity scoring algorithm
- [ ] MarkdownReporter

### Phase 3: Advanced Scanners (Week 3)
- [ ] UXScanner (accessibility, loading states)
- [ ] DataIntegrityScanner
- [ ] ErrorHandlingScanner
- [ ] AST-based analysis
- [ ] Context-aware detection

### Phase 4: Reporting & UX (Week 4)
- [ ] JsonReporter
- [ ] HtmlReporter (dashboard)
- [ ] Progress tracking UI
- [ ] Incremental audit support
- [ ] Comparison mode

### Phase 5: Integration (Week 5)
- [ ] Pre-commit hook
- [ ] CI/CD integration
- [ ] Bug tracking integration (optional)
- [ ] Documentation
- [ ] Testing

---

## 11. Testing Strategy

### 11.1 Test Fixtures

Create test files with known bugs:

```typescript
// tests/fixtures/logic-bugs.ts
// This file intentionally contains bugs for testing

export async function racyPayment() {
  // BUG: Race condition
  await processOrder();
  await chargeCreditCard();
  // No synchronization!
}

export function missingValidation(input: string) {
  // BUG: No validation
  return database.query(`SELECT * FROM users WHERE id = ${input}`);
}
```

### 11.2 Test Cases

```typescript
describe('LogicScanner', () => {
  it('should detect race conditions', async () => {
    const scanner = new LogicScanner();
    const file = await loadFixture('logic-bugs.ts');
    
    const bugs = await scanner.scan(file);
    
    expect(bugs).toHaveLength(2);
    expect(bugs[0].title).toContain('race condition');
  });
});
```

---

## 12. Performance Targets

- **Full Audit**: < 30 minutes for ~100 files
- **Incremental Audit**: < 5 minutes
- **Single File Scan**: < 2 seconds
- **Memory Usage**: < 500MB for full audit
- **Parallel Processing**: 4 concurrent files

---

## 13. Future Enhancements

1. **AI-Powered Analysis** (Phase 2)
   - Use Claude API để deep code understanding
   - Contextual bug detection beyond patterns
   - Auto-generate fix suggestions with full code

2. **Auto-Fix Capability** (Phase 2)
   - Safe fixes (add missing validation, type annotations)
   - Create git commits with fixes
   - Run tests after fix to verify

3. **Real-Time Monitoring** (Phase 3)
   - File watcher mode
   - Show bugs in IDE as you code
   - VS Code extension

4. **Bug Trend Analysis** (Phase 3)
   - Track bugs over time
   - Identify regression patterns
   - Developer/file hotspot analysis

5. **Custom Rules Engine** (Phase 3)
   - Allow users to define custom bug patterns
   - YAML-based rule definitions
   - Share rules across team

---

## 14. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| False positives | High - User loses trust | Manual review for Critical/High bugs |
| Performance too slow | Medium - Won't be used | Parallel processing, incremental mode |
| Missing context | Medium - Incorrect severity | Context-aware analysis, config file |
| AST parsing fails | Low - Some files skipped | Fallback to pattern matching |
| Large codebase OOM | Low - Crashes | Stream processing, file-by-file |

---

## 15. Success Criteria

✅ **Coverage**: >= 95% files scanned successfully
✅ **Accuracy**: <= 10% false positive rate
✅ **Performance**: Full audit in <= 30 min
✅ **Usability**: Clear actionable reports
✅ **Adoption**: Used regularly by developers
