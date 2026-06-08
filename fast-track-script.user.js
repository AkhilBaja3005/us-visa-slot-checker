// ==UserScript==
// @name         US Visa Booking Fast-Track
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Autofills security questions and speeds up consulate/OFC booking flows.
// @author       Antigravity
// @match        https://*.usvisascheduling.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // -------------------------------------------------------------
    // CONFIGURATION - UPDATE THESE WITH YOUR ACTUAL DETAILS
    // -------------------------------------------------------------
    const SECURITY_ANSWERS = {
        "job": "J",      // Answer to question containing "job" or "profession"
        "car": "C",      // Answer to question containing "car" or "vehicle"
        "school": "S",   // Answer to question containing "school"
        "food": "F"      // Answer to question containing "food" or "dish"
    };

    const PREFERRED_VAC = "CHENNAI VAC"; // Default consulate to select
    // -------------------------------------------------------------

    // Helper to find elements by text content
    function findLabelByText(text) {
        return Array.from(document.querySelectorAll('label')).find(
            el => el.textContent.toLowerCase().includes(text.toLowerCase())
        );
    }

    // 1. AUTOFILL SECURITY QUESTIONS (Runs on the challenge page)
    function handleSecurityQuestions() {
        const labels = document.querySelectorAll('label');
        labels.forEach(label => {
            const labelText = label.textContent.toLowerCase();
            const input = label.nextElementSibling?.querySelector('input') || document.getElementById(label.getAttribute('for'));
            
            if (input) {
                if (labelText.includes('job') || labelText.includes('employer') || labelText.includes('profession')) {
                    input.value = SECURITY_ANSWERS.job;
                } else if (labelText.includes('car') || labelText.includes('vehicle') || labelText.includes('model')) {
                    input.value = SECURITY_ANSWERS.car;
                } else if (labelText.includes('school') || labelText.includes('high school')) {
                    input.value = SECURITY_ANSWERS.school;
                } else if (labelText.includes('food') || labelText.includes('dish') || labelText.includes('cuisine')) {
                    input.value = SECURITY_ANSWERS.food;
                }
            }
        });

        // Click the submit button if inputs were filled
        const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
            console.log("Security questions autofilled. Submitting...");
            // submitBtn.click(); // Uncomment this line if you want it to submit automatically
        }
    }

    // 2. AUTO-NAVIGATE TO OFC APPOINTMENT PAGE (Runs on main dashboard)
    function handleDashboardNavigation() {
        if (window.location.href.endsWith('/en-US/')) {
            const ofcLink = Array.from(document.querySelectorAll('a')).find(
                a => a.textContent.toLowerCase().includes('schedule ofc appointment') || a.href.includes('ofc-schedule')
            );
            if (ofcLink) {
                console.log("Dashboard loaded. Redirecting to OFC Schedule page...");
                window.location.href = ofcLink.href;
            }
        }
    }

    // 3. AUTO-SELECT CONSULATE ON OFC SCHEDULE PAGE
    function handleOfcConsulateSelection() {
        if (window.location.href.includes('ofc-schedule')) {
            const dropdown = document.querySelector('select');
            if (dropdown) {
                // Find and select the option
                const option = Array.from(dropdown.options).find(
                    opt => opt.text.toUpperCase() === PREFERRED_VAC.toUpperCase()
                );
                if (option) {
                    console.log(`Selecting consulate: ${PREFERRED_VAC}`);
                    dropdown.value = option.value;
                    
                    // Trigger change event so the portal loads the dates calendar
                    const event = new Event('change', { bubbles: true });
                    dropdown.dispatchEvent(event);
                }
            }
        }
    }

    // Run execution cycle
    setTimeout(() => {
        handleSecurityQuestions();
        handleDashboardNavigation();
        handleOfcConsulateSelection();
    }, 1000); // Small delay to ensure dynamic DOM content is ready
})();
