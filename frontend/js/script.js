document.addEventListener('DOMContentLoaded', function() {
    const analysisForm = document.getElementById('analysisForm');
    const useAzureSwitch = document.getElementById('useAzureSwitch');
    const azureSection = document.getElementById('azureSection');
    const azureOrg = document.getElementById('azureOrg');
    const azureProject = document.getElementById('azureProject');
    const azurePat = document.getElementById('azurePat');
    const azureRepoSelect = document.getElementById('azureRepoSelect');
    const fetchAzureRepos = document.getElementById('fetchAzureRepos');
    const syncRepoUrl = document.getElementById('syncRepoUrl');
    // Toggle Azure section
    useAzureSwitch && useAzureSwitch.addEventListener('change', function() {
        if (this.checked) {
            azureSection.classList.remove('d-none');
        } else {
            azureSection.classList.add('d-none');
        }
    });

    // Fetch Azure repos
    fetchAzureRepos && fetchAzureRepos.addEventListener('click', function() {
        const org = azureOrg.value.trim();
        const project = azureProject.value.trim();
        const pat = azurePat.value;
        if (!org || !project || !pat) {
            showNotification('Please enter Azure org, project, and PAT', 'warning');
            return;
        }
        this.disabled = true;
        this.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Fetching...';
        fetch('/azure/repos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org, project, pat })
        })
        .then(async r => {
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                throw new Error(text || `Request failed (${r.status})`);
            }
            return r.json();
        })
        .then(data => {
            if (data.error) {
                showNotification('Azure error: ' + data.error, 'error');
                return;
            }
            azureRepoSelect.innerHTML = '';
            (data.repos || []).forEach(repo => {
                const opt = document.createElement('option');
                opt.value = repo.url;
                opt.textContent = repo.name + ' — ' + repo.url;
                azureRepoSelect.appendChild(opt);
                console.log('Added repo option:', repo.name, 'URL:', repo.url);
            });
            
            // Add a more direct approach - monitor for any selection changes
            azureRepoSelect.addEventListener('change', function() {
                console.log('Dropdown change event fired, value:', this.value);
                syncAzureRepoToUrl();
            });
            if ((data.repos || []).length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No repositories found';
                azureRepoSelect.appendChild(opt);
            }
            
            // Auto-sync if there's already a selected value
            setTimeout(() => {
                syncAzureRepoToUrl();
            }, 100);
            
            showNotification('Azure repositories fetched', 'success');
        })
        .catch(err => {
            console.error(err);
            const msg = (err && err.message) ? err.message : 'Failed to fetch Azure repositories';
            // Common guidance for 401/403
            const hint = ' Check PAT scope (Code: Read), org/project names, and that the PAT belongs to this org.';
            showNotification(msg + hint, 'error');
        })
        .finally(() => {
            this.disabled = false;
            this.innerHTML = '<i class="bi bi-download me-2"></i>Fetch Repos';
        });
    });

    // Function to sync selected Azure repo into the URL input
    function syncAzureRepoToUrl() {
        if (azureRepoSelect && azureRepoSelect.value) {
            const githubUrlField = document.getElementById('githubUrl');
            if (githubUrlField) {
                console.log('Syncing Azure repo to URL field:', azureRepoSelect.value);
                
                // Clear any validation errors first
                githubUrlField.setCustomValidity('');
                
                // Set the value
                githubUrlField.value = azureRepoSelect.value;
                
                // Trigger input event to ensure validation and UI updates
                githubUrlField.dispatchEvent(new Event('input', { bubbles: true }));
                githubUrlField.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Force validation check
                if (!githubUrlField.checkValidity()) {
                    console.warn('URL validation failed, but setting anyway:', azureRepoSelect.value);
                    githubUrlField.setCustomValidity(''); // Clear any custom validation
                }
                
                console.log('Azure repo selected:', azureRepoSelect.value);
                console.log('GitHub URL field updated to:', githubUrlField.value);
                console.log('Field validity:', githubUrlField.checkValidity());
            }
        }
    }

    // Sync selected Azure repo into the URL input - multiple event listeners for robustness
    if (azureRepoSelect) {
        azureRepoSelect.addEventListener('change', syncAzureRepoToUrl);
        azureRepoSelect.addEventListener('click', syncAzureRepoToUrl);
        azureRepoSelect.addEventListener('input', syncAzureRepoToUrl);
    }
    
    // Manual sync button
    if (syncRepoUrl) {
        syncRepoUrl.addEventListener('click', function() {
            console.log('Manual sync button clicked');
            syncAzureRepoToUrl();
            showNotification('Repository URL synced!', 'success');
        });
    }
    
    // MutationObserver to watch for dropdown value changes as backup
    if (azureRepoSelect) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                    console.log('Dropdown value changed via mutation observer');
                    syncAzureRepoToUrl();
                }
            });
        });
        
        // Watch for changes to the select element
        observer.observe(azureRepoSelect, {
            attributes: true,
            attributeFilter: ['value', 'selectedIndex']
        });
    }
    
    // Polling mechanism as last resort - check every 500ms if dropdown has a value but URL field is empty
    let lastDropdownValue = '';
    setInterval(() => {
        if (azureRepoSelect && azureRepoSelect.value && azureRepoSelect.value !== lastDropdownValue) {
            const githubUrlField = document.getElementById('githubUrl');
            if (githubUrlField && (!githubUrlField.value || githubUrlField.value !== azureRepoSelect.value)) {
                console.log('Polling detected mismatch - syncing URL');
                syncAzureRepoToUrl();
            }
            lastDropdownValue = azureRepoSelect.value;
        }
    }, 500);
    const resultsSection = document.getElementById('resultsSection');
    const uncoveredFunctionsList = document.getElementById('uncoveredFunctionsList');
    const generatedTestCard = document.getElementById('generatedTestCard');
    const existingTestCode = document.getElementById('existingTestCode');
    const combinedTestCode = document.getElementById('combinedTestCode');
    const copyTestBtn = document.getElementById('copyTestBtn');
    const copyNewOnlyBtn = document.getElementById('copyNewOnlyBtn');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    
    let currentAnalysis = null;
    
    analysisForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const githubUrl = document.getElementById('githubUrl').value;
        const isAzure = /dev\.azure\.com|visualstudio\.com/i.test(githubUrl);
        const body = { github_url: githubUrl };
        if (isAzure && azurePat && azurePat.value) {
            body.azure_pat = azurePat.value;
        }
        
        // Add loading state
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Analyzing...';
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        
        // Show progress indicator
        const analysisProgress = document.getElementById('analysisProgress');
        analysisProgress.classList.remove('d-none');
        
        // Update progress message
        const progressMessage = analysisProgress.querySelector('.alert');
        progressMessage.innerHTML = `
            <i class="bi bi-hourglass-split me-2"></i>
            <strong>Analysis in Progress...</strong>
            <div class="mt-2">
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated" 
                         role="progressbar" style="width: 100%"></div>
                </div>
            </div>
            <small class="text-muted">Step 1/4: Cloning repository...</small>
        `;
        
        fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Analysis response:', data); // Debug logging
            
            if (data.error) {
                let msg = 'Error: ' + data.error;
                if (data.full_error) {
                    msg += '\nDetails: ' + data.full_error;
                }
                
                // Handle repository type-specific errors
                if (data.repository_type) {
                    displayRepositoryTypeError(data);
                } else {
                    showNotification(msg, 'error');
                }
                return;
            }
            
            currentAnalysis = data;
            displayResults(data);
            resultsSection.classList.remove('d-none');
            
            // Scroll to results
            resultsSection.scrollIntoView({ behavior: 'smooth' });
            
            showNotification('Analysis completed successfully!', 'success');
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('An error occurred during analysis', 'error');
        })
        .finally(() => {
            // Reset button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            
            // Hide progress indicator
            analysisProgress.classList.add('d-none');
        });
    });
    
    function displayResults(data) {
        // Update progress bar
        const coverageProgress = document.getElementById('coverageProgress');
        const coveragePercentage = Math.round(data.coverage_percentage);
        
        // Animate progress bar width
        setTimeout(() => {
        coverageProgress.style.width = `${coveragePercentage}%`;
        coverageProgress.textContent = `${coveragePercentage}%`;
        coverageProgress.setAttribute('aria-valuenow', coveragePercentage);
        }, 300);
        
        // Update coverage metrics with animation
        animateNumber('totalFunctions', data.total_functions);
        animateNumber('coveredFunctions', data.covered_functions);
        animateNumber('uncoveredFunctions', data.uncovered_functions.length);
        
        // Update project detection information
        document.getElementById('detectedLanguage').textContent = data.language || 'Not detected';
        document.getElementById('detectedFramework').textContent = data.framework || 'Not detected';
        document.getElementById('coverageTool').textContent = data.coverage_tool || 'Not detected';
        
        // Coverage mode badge
        const coverageModeEl = document.getElementById('coverageMode');
        const mode = (data.coverage_mode || 'heuristic').toLowerCase();
        coverageModeEl.textContent = mode === 'tool' ? 'Tool (Executed)' : 'Heuristic';
        coverageModeEl.classList.remove('bg-info', 'bg-secondary', 'bg-success');
        coverageModeEl.classList.add(mode === 'tool' ? 'bg-success' : 'bg-info');
        
        // Show repository type information
        if (data.repository_type && data.analysis_message) {
            displayRepositoryTypeInfo(data.repository_type, data.analysis_message);
        }
        
        // Show repository size warning if it's a large repository
        const repositorySizeWarning = document.getElementById('repositorySizeWarning');
        if (data.repository_size === 'large') {
            repositorySizeWarning.classList.remove('d-none');
            repositorySizeWarning.innerHTML = `
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>Large Repository Detected:</strong> This repository contains many files. 
                Analysis has been limited to the most relevant files for performance. 
                <br><br>
                <strong>Analysis Scope:</strong> ${data.src_files ? data.src_files.length : 0} source files, 
                ${data.test_files ? data.test_files.length : 0} test files analyzed.
                <br>
                <strong>Note:</strong> Consider analyzing specific modules or directories for more detailed results.
            `;
        } else {
            repositorySizeWarning.classList.add('d-none');
        }
        
        // Hide repository type warning if analysis succeeded
        document.getElementById('repositoryTypeWarning').classList.add('d-none');
        
        // Line and Branch coverage removed from UI as they were showing 0%
        
        // Update coverage files information
        const coverageFilesList = document.getElementById('coverageFilesList');
        if (data.coverage_file_paths && data.coverage_file_paths.length > 0) {
            let filesHtml = '<ul class="list-group">';
            data.coverage_file_paths.forEach((filePath, index) => {
                filesHtml += `<li class="list-group-item coverage-file-item" style="animation-delay: ${index * 0.1}s">
                    <i class="bi bi-file-earmark-text me-2"></i>
                    <code>${filePath}</code>
                </li>`;
            });
            filesHtml += '</ul>';
            coverageFilesList.innerHTML = filesHtml;
        } else {
            coverageFilesList.innerHTML = '<p class="text-muted text-center py-3">No coverage files generated.</p>';
        }
        
        // Populate uncovered functions table with animation
        uncoveredFunctionsList.innerHTML = '';
        data.uncovered_functions.forEach((func, index) => {
            const row = document.createElement('tr');
            row.className = 'function-row';
            row.style.animationDelay = `${index * 0.05}s`;
            row.innerHTML = `
                <td>
                    <i class="bi bi-exclamation-circle text-warning me-2"></i>
                    <code>${func}</code>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary generate-test-btn" data-function="${func}">
                        <i class="bi bi-magic me-1"></i>Generate Test
                    </button>
                </td>
            `;
            uncoveredFunctionsList.appendChild(row);
        });
        
        // Add event listeners to generate test buttons
        document.querySelectorAll('.generate-test-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const funcName = this.getAttribute('data-function');
                generateTest(funcName);
            });
        });
    }
    
    function animateNumber(elementId, targetValue) {
        const element = document.getElementById(elementId);
        const startValue = 0;
        const duration = 1000;
        const startTime = performance.now();
        
        function updateNumber(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.round(startValue + (targetValue - startValue) * progress);
            element.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            }
        }
        
        requestAnimationFrame(updateNumber);
    }
    
    function animatePercentage(elementId, targetValue) {
        const element = document.getElementById(elementId);
        const startValue = 0;
        const duration = 1000;
        const startTime = performance.now();
        
        function updatePercentage(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.round(startValue + (targetValue - startValue) * progress);
            element.textContent = `${currentValue}%`;
            
            if (progress < 1) {
                requestAnimationFrame(updatePercentage);
            }
        }
        
        requestAnimationFrame(updatePercentage);
    }
    
    function generateTest(funcName) {
        const btn = document.querySelector(`[data-function="${funcName}"]`);
        const originalText = btn.innerHTML;
        
        // Add loading state
        btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Generating...';
        btn.disabled = true;
        btn.classList.add('loading');
        
        fetch('/generate-tests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                language: currentAnalysis.language,
                uncovered_functions: [funcName],
                framework: currentAnalysis.framework,
                uncovered_function_details: currentAnalysis.uncovered_function_details,
                existing_test_cases: currentAnalysis.existing_test_cases
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Test generation response:', data); // Debug logging
            
            if (data.error) {
                showNotification('Error: ' + data.error, 'error');
                return;
            }
            
            // Handle the backend response format
            if (data.combined_results && data.combined_results[funcName]) {
            const result = data.combined_results[funcName];
                console.log('Found combined results for function:', funcName, result); // Debug logging
                displayGeneratedTest({
                    existing_test_cases: result.existing_tests,
                    combined_test_cases: result.combined_tests
                });
            } else {
                // Fallback for different response format
                console.log('No combined results found, using fallback format'); // Debug logging
                displayGeneratedTest(data);
            }
            
            generatedTestCard.classList.remove('d-none');
            
            // Scroll to generated test
            generatedTestCard.scrollIntoView({ behavior: 'smooth' });
            
            showNotification('Test generated successfully!', 'success');
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('An error occurred while generating test', 'error');
        })
        .finally(() => {
            // Reset button state
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.classList.remove('loading');
        });
    }
    
    function displayGeneratedTest(data) {
        // Display existing test cases
        if (data.existing_test_cases && data.existing_test_cases.trim()) {
            existingTestCode.textContent = data.existing_test_cases;
            existingTestCode.style.display = 'block';
        } else {
            existingTestCode.textContent = 'No existing tests found for this function.';
            existingTestCode.style.display = 'block';
        }
        
        // Display combined test cases with syntax highlighting
        if (data.combined_test_cases && data.combined_test_cases.trim()) {
            combinedTestCode.innerHTML = highlightNewTests(data.combined_test_cases, data.existing_test_cases || '');
            combinedTestCode.style.display = 'block';
        } else {
            combinedTestCode.textContent = 'Test generation failed. Please check the console for errors.';
            combinedTestCode.style.display = 'block';
        }
    }
    
    function highlightNewTests(combinedTests, existingTests) {
        if (!existingTests || !combinedTests) {
            return combinedTests;
        }
        
        // Simple highlighting - wrap new content in highlight class
        const existingLines = existingTests.split('\n');
        const combinedLines = combinedTests.split('\n');
        
        let highlightedHTML = '';
        let inNewSection = false;
        
        for (let i = 0; i < combinedLines.length; i++) {
            const line = combinedLines[i];
            const isNewLine = !existingLines.includes(line.trim());
            
            if (isNewLine && !inNewSection) {
                highlightedHTML += '<span class="highlight-new">';
                inNewSection = true;
            } else if (!isNewLine && inNewSection) {
                highlightedHTML += '</span>';
                inNewSection = false;
            }
            
            highlightedHTML += line + '\n';
        }
        
        if (inNewSection) {
            highlightedHTML += '</span>';
        }
        
        return highlightedHTML;
    }
    
    // Copy functionality
    copyTestBtn.addEventListener('click', function() {
        copyToClipboard(combinedTestCode.textContent);
        showNotification('Combined tests copied to clipboard!', 'success');
    });
    
    copyNewOnlyBtn.addEventListener('click', function() {
        const newTests = extractNewTestsOnly();
        copyToClipboard(newTests);
        showNotification('New tests only copied to clipboard!', 'success');
    });
    
    function extractNewTestsOnly() {
        const combinedText = combinedTestCode.textContent;
        const existingText = existingTestCode.textContent;
        
        if (!existingText || existingText === 'No existing tests found for this function.') {
            return combinedText;
        }
        
        // Find the comment that marks new tests
        const commentMatch = combinedText.match(/# NEWLY GENERATED TEST FOR MISSING COVERAGE/);
        if (commentMatch) {
            const commentIndex = commentMatch.index;
            return combinedText.substring(commentIndex);
        }
        
        // Fallback: try to find differences
        const existingLines = existingText.split('\n');
        const combinedLines = combinedText.split('\n');
        const newLines = [];
        
        for (const line of combinedLines) {
            if (!existingLines.includes(line.trim()) && line.trim()) {
                newLines.push(line);
            }
        }
        
        if (newLines.length > 0) {
            return newLines.join('\n');
        }
        
        // If no differences found, return the combined text
        return combinedText;
    }
    
    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
    }
    
    // Download report functionality
    downloadReportBtn.addEventListener('click', function() {
        if (!currentAnalysis) {
            showNotification('No analysis data available for download', 'warning');
            return;
        }
        
        const report = generateReport();
        downloadFile(report, 'coverage-report.txt', 'text/plain');
        showNotification('Report downloaded successfully!', 'success');
    });
    
    function generateReport() {
        const report = [];
        report.push('TEST COVERAGE ANALYSIS REPORT');
        report.push('='.repeat(50));
        report.push('');
        report.push(`Repository Analysis: ${new Date().toLocaleString()}`);
        report.push(`Language: ${currentAnalysis.language}`);
        report.push(`Framework: ${currentAnalysis.framework}`);
        report.push(`Coverage Tool: ${currentAnalysis.coverage_tool}`);
        report.push('');
        report.push('COVERAGE SUMMARY');
        report.push('-'.repeat(20));
        report.push(`Total Functions: ${currentAnalysis.total_functions}`);
        report.push(`Covered Functions: ${currentAnalysis.covered_functions}`);
        report.push(`Uncovered Functions: ${currentAnalysis.uncovered_functions.length}`);
        report.push(`Function Coverage: ${Math.round(currentAnalysis.coverage_percentage)}%`);
        report.push(`Line Coverage: ${Math.round(currentAnalysis.line_coverage_percentage || 0)}%`);
        report.push(`Branch Coverage: ${Math.round(currentAnalysis.branch_coverage_percentage || 0)}%`);
        report.push('');
        
        if (currentAnalysis.uncovered_functions.length > 0) {
            report.push('UNCOVERED FUNCTIONS');
            report.push('-'.repeat(20));
            currentAnalysis.uncovered_functions.forEach(func => {
                report.push(`- ${func}`);
            });
        }
        
        return report.join('\n');
    }
    
    function downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }
    
    // Notification system
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
        notification.innerHTML = `
            <i class="bi bi-${getNotificationIcon(type)} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
    
    function getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-triangle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    function displayRepositoryTypeError(data) {
        // Show repository type-specific error message
        const repositoryTypeWarning = document.getElementById('repositoryTypeWarning');
        const repoTypeWarningTitle = document.getElementById('repoTypeWarningTitle');
        const repoTypeWarningMessage = document.getElementById('repoTypeWarningMessage');
        
        // Set the warning title
        repoTypeWarningTitle.textContent = data.error || 'Repository Type Issue';
        
        // Set the warning message based on repository type
        let warningMessage = '';
        if (data.details) {
            warningMessage += `<strong>Issue:</strong> ${data.details}<br><br>`;
        }
        if (data.solution) {
            warningMessage += `<strong>Solution:</strong> ${data.solution}<br><br>`;
        }
        if (data.repository_type) {
            warningMessage += `<strong>Repository Type:</strong> <span class="badge bg-secondary">${data.repository_type}</span>`;
        }
        
        repoTypeWarningMessage.innerHTML = warningMessage;
        repositoryTypeWarning.classList.remove('d-none');
        
        // Show notification
        let msg = data.error;
        if (data.details) {
            msg += ': ' + data.details;
        }
        showNotification(msg, 'warning');
        
        // Hide other sections
        document.getElementById('resultsSection').classList.add('d-none');
    }

    function displayRepositoryTypeInfo(repoType, analysisMessage) {
        const repositoryTypeInfo = document.getElementById('repositoryTypeInfo');
        const repoTypeTitle = document.getElementById('repoTypeTitle');
        const repoTypeMessage = document.getElementById('repoTypeMessage');
        
        // Safe title-case for repo type string (e.g., mixed_content -> Mixed Content)
        const readableType = (repoType || '')
            .toString()
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
        
        // Set the title
        repoTypeTitle.textContent = `Repository Type: ${readableType}`;
        
        // Set the message based on repository type
        let message = '';
        if (analysisMessage.message) {
            message += `<strong>Description:</strong> ${analysisMessage.message}<br><br>`;
        }
        if (analysisMessage.warning) {
            message += `<strong>Warning:</strong> ${analysisMessage.warning}<br><br>`;
        }
        if (analysisMessage.alternatives) {
            message += `<strong>Recommendations:</strong> ${analysisMessage.alternatives}`;
        }
        
        repoTypeMessage.innerHTML = message;
        repositoryTypeInfo.classList.remove('d-none');
        
        // Show warning if it's a mixed-content repository
        if (repoType === 'mixed_content' && analysisMessage.warning) {
            const repositoryTypeWarning = document.getElementById('repositoryTypeWarning');
            const repoTypeWarningTitle = document.getElementById('repoTypeWarningTitle');
            const repoTypeWarningMessage = document.getElementById('repoTypeWarningMessage');
            
            repoTypeWarningTitle.textContent = 'Mixed-Content Repository Warning';
            repoTypeWarningMessage.innerHTML = `
                <strong>Warning:</strong> ${analysisMessage.warning}<br><br>
                <strong>Recommendations:</strong> ${analysisMessage.alternatives || 'Consider analyzing specific language directories.'}
            `;
            repositoryTypeWarning.classList.remove('d-none');
        }
    }
});