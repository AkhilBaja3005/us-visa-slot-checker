// --- Custom Credentials & Security Questions Autofill ---
(function() {
  let isAutofilling = false;
  
  async function attemptAutofill() {
    if (isAutofilling) return;
    isAutofilling = true;

    chrome.runtime.sendMessage({ action: "getCredentials" }, (response) => {
      isAutofilling = false;
      if (!response || !response.success || !response.data) {
        if (response && response.error) {
          console.warn("Autofill credentials fetch failed:", response.error);
        }
        return;
      }
      
      const creds = response.data;
      if (!creds.portalUsername && !creds.portalPassword) return;

      // 1. Username & Password fields
      const emailInput = document.querySelector('#email, #logonIdentifier, #username, #signInName, input[type="email"], input[name*="username" i], input[name*="login" i], input[id*="signin" i], input[id*="login" i], input[id*="user" i], input[placeholder*="username" i], input[placeholder*="email" i]');
      const passwordInput = document.querySelector('#password, input[type="password"]');

      if (emailInput && creds.portalUsername && emailInput.value !== creds.portalUsername) {
        emailInput.value = creds.portalUsername;
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (passwordInput && creds.portalPassword && passwordInput.value !== creds.portalPassword) {
        // Prevent filling password field if it is a security question response field
        const id = passwordInput.getAttribute('id') || "";
        const isKba = id.includes("kba") || id.includes("response") || id.includes("Security");
        if (!isKba) {
          passwordInput.value = creds.portalPassword;
          passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
          passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // 2. Security Questions fields
      const questionsList = document.querySelectorAll('#attributeList li.Paragraph p.textInParagraph');
      const responseInputs = document.querySelectorAll('input[id$="_response"], input[id*="response" i], input[id*="kba" i], input[id*="kbq" i], input[id*="Security" i]');

      if (questionsList.length > 0 || responseInputs.length > 0) {
        const matchAnswer = (qText) => {
          const lower = qText.toLowerCase();
          if (lower.includes("school") || lower.includes("education") || lower.includes("college") || lower.includes("study")) {
            return creds.securitySchool;
          } else if (lower.includes("car") || lower.includes("vehicle") || lower.includes("automobile") || lower.includes("drive")) {
            return creds.securityCar;
          } else if (lower.includes("job") || lower.includes("work") || lower.includes("profession") || lower.includes("employer") || lower.includes("occupation") || lower.includes("company") || lower.includes("city or town")) {
            return creds.securityJob;
          } else if (lower.includes("food") || lower.includes("dish") || lower.includes("eat") || lower.includes("restaurant")) {
            return creds.securityFood;
          }
          return "";
        };

        responseInputs.forEach(input => {
          // Only fill if it doesn't already have a value
          if (!input.value) {
            let qText = "";
            let liParent = input.closest('li');
            if (liParent) {
              let sibling = liParent.previousElementSibling;
              while (sibling) {
                let textEl = sibling.querySelector('p.textInParagraph');
                if (textEl && textEl.innerText.trim()) {
                  qText = textEl.innerText.trim();
                  break;
                }
                sibling = sibling.previousElementSibling;
              }
            }
            if (!qText) {
              let parent = input.parentElement;
              for (let i = 0; i < 3 && parent; i++) {
                const label = parent.querySelector('label, .label, .question, [id*="ReadOnly" i]');
                if (label && label.innerText.trim()) {
                  qText = label.innerText.trim();
                  break;
                }
                parent = parent.parentElement;
              }
            }

            if (qText) {
              const answer = matchAnswer(qText);
              if (answer) {
                input.value = answer;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }
        });
      }
    });
  }

  // Poll for input fields to fill them as they render dynamically
  setInterval(attemptAutofill, 1000);
})();
