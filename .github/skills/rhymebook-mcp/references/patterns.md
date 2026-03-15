# RhymeBook Patterns & Anti-Patterns

## ✅ Good Patterns

### Pattern 1: Tool Registration with Full Schema
```typescript
registerAppTool(
  server,
  'tool-name',
  {
    title: 'Human Readable Title',
    description: 'Clear description of what the tool does and when to use it',
    inputSchema: {
      requiredParam: z.string().min(1).max(200).describe('Required parameter'),
      optionalParam: z.number().optional().describe('Optional parameter'),
      enumParam: z.enum(['option1', 'option2']).describe('Choose one'),
    },
    _meta: {
      ui: {
        resourceUri: 'ui://rhymebook/app.html',
      },
    },
  },
  async (params) => {
    // Implementation
  }
);
```

### Pattern 2: Database Operation with Error Handling
```typescript
export function getItem(id: string): ItemType | null {
  try {
    const db = getDatabase();
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemType | null;
    return item;
  } catch (error) {
    console.error('Error getting item:', error);
    return null;
  }
}
```

### Pattern 3: Async File Operation
```typescript
async function processFile(filePath: string): Promise<Result> {
  try {
    // Validate path
    const normalized = normalize(resolve(filePath));
    if (!normalized.startsWith(ALLOWED_DIR)) {
      return { error: 'Access denied' };
    }

    // Check exists
    try {
      await fs.access(normalized);
    } catch {
      return { error: 'File not found' };
    }

    // Process
    const content = await fs.readFile(normalized, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { error: `Processing failed: ${error.message}` };
  }
}
```

### Pattern 4: UI Component with Loading States
```typescript
async function loadData() {
  showLoading('container-id', 'Loading data...');
  
  try {
    const result = await app.callServerTool({
      name: 'tool-name',
      arguments: { param: 'value' },
    });
    
    const data = JSON.parse(getTextContent(result));
    renderData(data);
  } catch (error) {
    showToast('Failed to load data', 'error');
    showErrorState('container-id');
  } finally {
    hideLoading('container-id');
  }
}
```

### Pattern 5: CSS Component with Theme Variables
```css
.new-component {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  color: var(--text-primary);
}

.new-component:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 4px 12px rgba(147, 51, 234, 0.1);
}
```

## ❌ Anti-Patterns to Avoid

### Anti-Pattern 1: Synchronous File Operations
```typescript
// BAD: Blocks event loop
const content = fs.readFileSync(filePath, 'utf-8');
const stat = fs.statSync(filePath);

// GOOD: Non-blocking
const content = await fs.readFile(filePath, 'utf-8');
const stat = await fs.stat(filePath);
```

### Anti-Pattern 2: No Input Validation
```typescript
// BAD: No validation
async ({ title, content }) => {
  db.prepare('INSERT INTO songs (title, content) VALUES (?, ?)').run(title, content);
}

// GOOD: With validation
inputSchema: {
  title: z.string().min(1).max(200).describe('Song title'),
  content: z.string().max(50000).describe('Lyrics content'),
}
```

### Anti-Pattern 3: Exposing Internal Paths
```typescript
// BAD: Exposes file system structure
return { error: `File not found: ${filePath}` };

// GOOD: Generic message
return { error: 'File not found' };
```

### Anti-Pattern 4: No Error Handling
```typescript
// BAD: Will crash on error
const data = JSON.parse(result.content[0].text);

// GOOD: Handles errors
try {
  const textContent = result.content.find(c => c.type === 'text');
  if (!textContent) throw new Error('No text content');
  const data = JSON.parse(textContent.text);
} catch (error) {
  return { error: `Failed to parse: ${error.message}` };
}
```

### Anti-Pattern 5: Multiple DOM Updates
```typescript
// BAD: Causes reflow multiple times
items.forEach(item => {
  container.innerHTML += `<div>${item}</div>`;
});

// GOOD: Single DOM update
const html = items.map(item => `<div>${item}</div>`).join('');
container.innerHTML = html;
```

## 🔧 Code Snippets

### Extract Text from Tool Result
```typescript
function getTextContent(result: any): string {
  const textItem = result.content?.find((c: any) => c.type === 'text');
  if (textItem && 'text' in textItem) {
    return textItem.text;
  }
  throw new Error('No text content in result');
}
```

### Generate Unique ID
```typescript
function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}
```

### Format File Size
```typescript
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

### Show Toast Notification
```typescript
function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
```

### Debounce Function
```typescript
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```
