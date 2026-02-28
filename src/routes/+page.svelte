<script lang="ts">
    import '98.css';
    
    let selectedTable = 'users';
    let queryText = 'SELECT * FROM users';
    let queryResult: string | any[] = [];
    let isQuerying = false;
    let errorMessage = '';
    
    // Mock database tables
    const tables: Record<string, any[]> = {
      users: [
        { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '1998-04-15' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '1998-05-20' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', created_at: '1998-06-10' },
        { id: 4, name: 'Alice Brown', email: 'alice@example.com', created_at: '1998-07-22' },
        { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', created_at: '1998-08-30' }
      ],
      products: [
        { id: 1, name: 'Windows 98', price: 209.00, category: 'Operating System', stock: 50 },
        { id: 2, name: 'Office 97', price: 499.00, category: 'Productivity', stock: 30 },
        { id: 3, name: 'Visual Studio 6.0', price: 1299.00, category: 'Development', stock: 15 },
        { id: 4, name: 'Age of Empires', price: 49.99, category: 'Games', stock: 100 },
        { id: 5, name: 'Internet Explorer 5', price: 0.00, category: 'Browser', stock: 999 }
      ],
      orders: [
        { id: 1, user_id: 1, product_id: 2, quantity: 1, order_date: '1998-09-10', status: 'completed' },
        { id: 2, user_id: 2, product_id: 1, quantity: 2, order_date: '1998-09-15', status: 'completed' },
        { id: 3, user_id: 3, product_id: 4, quantity: 1, order_date: '1998-09-20', status: 'pending' },
        { id: 4, user_id: 1, product_id: 3, quantity: 1, order_date: '1998-09-25', status: 'completed' },
        { id: 5, user_id: 4, product_id: 5, quantity: 3, order_date: '1998-09-30', status: 'shipped' }
      ],
      categories: [
        { id: 1, name: 'Operating System', description: 'System software' },
        { id: 2, name: 'Productivity', description: 'Office and productivity tools' },
        { id: 3, name: 'Development', description: 'Development tools and IDEs' },
        { id: 4, name: 'Games', description: 'Entertainment software' },
        { id: 5, name: 'Browser', description: 'Web browsing software' }
      ]
    };
    
    function selectTable(tableName: string) {
      selectedTable = tableName;
      queryText = `SELECT * FROM ${tableName}`;
      errorMessage = '';
    }
    
    function executeQuery() {
      isQuerying = true;
      errorMessage = '';
      
      // Simulate query delay
      setTimeout(() => {
        try {
          // Very basic SQL parser (only handles SELECT * FROM table)
          const selectMatch = queryText.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
          
          if (selectMatch) {
            const tableName = selectMatch[1].toLowerCase();
            if (tables[tableName]) {
              queryResult = tables[tableName];
            } else {
              errorMessage = `Table '${tableName}' does not exist.`;
              queryResult = [];
            }
          } else if (queryText.toLowerCase().includes('insert') || 
                     queryText.toLowerCase().includes('update') || 
                     queryText.toLowerCase().includes('delete') || 
                     queryText.toLowerCase().includes('drop')) {
            errorMessage = 'Permission denied: This is a read-only database.';
            queryResult = [];
          } else {
            errorMessage = 'Syntax error: Only SELECT * FROM table queries are supported in this demo.';
            queryResult = [];
          }
        } catch (error) {
          errorMessage = 'Query execution failed.';
          queryResult = [];
        }
        
        isQuerying = false;
      }, 500);
    }
    
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'F5' || (event.ctrlKey && event.key === 'Enter')) {
        event.preventDefault();
        executeQuery();
      }
    }
  </script>
  
  <svelte:window on:keydown={handleKeyDown} />
  
  <div class="window" style="width: 100%; height: 100vh; margin: 0;">
    <div class="title-bar">
      <div class="title-bar-text">SQL.bz - Query Analyzer [Read-Only Mode]</div>
      <div class="title-bar-controls">
        <button aria-label="Minimize"></button>
        <button aria-label="Maximize"></button>
        <button aria-label="Close"></button>
      </div>
    </div>
    
    <div class="window-body" style="margin: 0; height: calc(100vh - 28px); display: flex; flex-direction: column;">
      <!-- Menu Bar -->
      <div class="menu-bar" style="margin-bottom: 2px;">
        <button class="menu-bar-item">File</button>
        <button class="menu-bar-item">Edit</button>
        <button class="menu-bar-item">View</button>
        <button class="menu-bar-item">Query</button>
        <button class="menu-bar-item">Tools</button>
        <button class="menu-bar-item">Window</button>
        <button class="menu-bar-item">Help</button>
      </div>
      
      <!-- Toolbar -->
      <div class="toolbar" style="padding: 2px; border-bottom: 1px solid #868686;">
        <button class="toolbar-button" onclick={() => executeQuery()} disabled={isQuerying}>
          ▶ Execute
        </button>
        <span class="separator"></span>
        <button class="toolbar-button" disabled>
          💾 Save
        </button>
        <button class="toolbar-button" disabled>
          📁 Open
        </button>
        <span class="separator"></span>
        <span style="margin-left: 10px; font-size: 11px;">Press F5 or Ctrl+Enter to execute query</span>
      </div>
      
      <!-- Main Content Area -->
      <div style="display: flex; flex: 1; overflow: hidden;">
        <!-- Left Panel - Database Objects -->
        <div class="window" style="width: 200px; margin: 4px;">
          <div class="title-bar">
            <div class="title-bar-text">Object Explorer</div>
          </div>
          <div class="window-body" style="padding: 0; height: calc(100% - 18px); overflow-y: auto;">
            <ul class="tree-view">
              <li>
                <details open>
                  <summary>📁 sql.bz (Read-Only)</summary>
                  <ul>
                    <li>
                      <details open>
                        <summary>📁 Tables</summary>
                        <ul>
                          {#each Object.keys(tables) as table}
                            <li>
                              <button 
                                class="tree-item {selectedTable === table ? 'selected' : ''}"
                                onclick={() => selectTable(table)}
                                style="width: 100%; text-align: left; padding: 2px 4px; border: none; background: {selectedTable === table ? '#000080' : 'transparent'}; color: {selectedTable === table ? 'white' : 'black'};"
                              >
                                📋 {table}
                              </button>
                            </li>
                          {/each}
                        </ul>
                      </details>
                    </li>
                  </ul>
                </details>
              </li>
            </ul>
          </div>
        </div>
        
        <!-- Right Panel - Query and Results -->
        <div style="flex: 1; display: flex; flex-direction: column; margin: 4px;">
          <!-- Query Editor -->
          <div class="window" style="height: 200px; margin-bottom: 4px;">
            <div class="title-bar">
              <div class="title-bar-text">Query Editor</div>
            </div>
            <div class="window-body" style="padding: 0; height: calc(100% - 18px);">
              <textarea 
                bind:value={queryText}
                style="width: 100%; height: 100%; font-family: 'Courier New', monospace; font-size: 12px; resize: none; border: none; padding: 4px;"
                placeholder="Enter your SQL query here..."
              ></textarea>
            </div>
          </div>
          
          <!-- Results Grid -->
          <div class="window" style="flex: 1;">
            <div class="title-bar">
              <div class="title-bar-text">Results</div>
            </div>
            <div class="window-body" style="padding: 0; height: calc(100% - 18px); overflow: auto;">
              {#if errorMessage}
                <div style="padding: 10px; color: red; font-family: monospace; font-size: 12px;">
                  ❌ {errorMessage}
                </div>
              {:else if isQuerying}
                <div style="padding: 10px;">
                  <div class="progress-indicator"></div>
                  Executing query...
                </div>
              {:else if queryResult.length > 0}
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <thead>
                    <tr style="background: #c0c0c0;">
                      {#each Object.keys(queryResult[0]) as column}
                        <th style="border: 1px solid #868686; padding: 2px 4px; text-align: left;">
                          {column}
                        </th>
                      {/each}
                    </tr>
                  </thead>
                  <tbody>
                    {#each queryResult as row}
                      <tr>
                        {#each Object.values(row) as value}
                          <td style="border: 1px solid #868686; padding: 2px 4px;">
                            {value}
                          </td>
                        {/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
                <div style="padding: 4px; background: #c0c0c0; font-size: 11px;">
                  {queryResult.length} row(s) returned
                </div>
              {:else}
                <div style="padding: 10px; color: #666; font-size: 12px;">
                  No results to display. Execute a query to see results.
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Status Bar -->
      <div class="status-bar" style="margin-top: auto;">
        <p class="status-bar-field">Ready</p>
        <p class="status-bar-field">Read-Only Mode</p>
        <p class="status-bar-field">sql.bz</p>
      </div>
    </div>
  </div>
  
  <style>
    :global(body) {
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    
    .toolbar {
      display: flex;
      align-items: center;
      background: #c0c0c0;
    }
    
    .toolbar-button {
      padding: 4px 8px;
      margin: 2px;
      font-size: 11px;
    }
    
    .separator {
      width: 1px;
      height: 20px;
      background: #868686;
      margin: 0 4px;
    }
    
    .tree-item:hover {
      background: #000080 !important;
      color: white !important;
    }
    
    .progress-indicator {
      width: 150px;
      height: 20px;
      background: repeating-linear-gradient(
        90deg,
        #000080,
        #000080 10px,
        #c0c0c0 10px,
        #c0c0c0 20px
      );
      animation: progress 1s linear infinite;
      margin-bottom: 10px;
    }
    
    @keyframes progress {
      0% {
        background-position: 0 0;
      }
      100% {
        background-position: 20px 0;
      }
    }
    
    .menu-bar {
      display: flex;
      background: #c0c0c0;
      border-bottom: 1px solid white;
      border-top: 1px solid white;
    }
    
    .menu-bar-item {
      padding: 4px 8px;
      border: none;
      background: transparent;
      font-size: 11px;
      cursor: pointer;
    }
    
    .menu-bar-item:hover {
      background: #000080;
      color: white;
    }
  </style>