import dotenv from 'dotenv';

dotenv.config();

const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
const apiKey = process.env.AI_API_KEY || '';
const customModel = process.env.AI_MODEL;
const customEndpoint = process.env.AI_CUSTOM_ENDPOINT;

/**
 * Strips code blocks and potential preambles to parse a clean JSON response.
 */
function cleanAndParseJSON(responseText: string): any {
  let cleaned = responseText.trim();
  
  // Remove markdown code fences if present (e.g. ```json ... ``` or ``` ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  }

  // Find the first '{' and the last '}'
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error('Response did not contain a valid JSON object');
  }

  cleaned = cleaned.substring(startIdx, endIdx + 1);

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse clean JSON from text:', cleaned);
    throw new Error('LLM response was not valid JSON');
  }
}

/**
 * Calls the selected LLM provider and returns the raw string content.
 */
async function callLLM(prompt: string, systemInstruction?: string): Promise<string> {
  if (!apiKey || apiKey.startsWith('YOUR_')) {
    throw new Error(`AI API key for provider "${provider}" is not configured in .env`);
  }

  const defaultModels: Record<string, string> = {
    anthropic: 'claude-3-5-sonnet-20241022',
    gemini: 'gemini-1.5-pro',
    openrouter: 'anthropic/claude-3.5-sonnet:beta',
    nvidia: 'meta/llama3-70b-instruct'
  };

  const model = customModel || defaultModels[provider] || defaultModels.anthropic;

  switch (provider) {
    case 'gemini': {
      const url = customEndpoint || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction ? systemInstruction + '\n\n' : ''}${prompt}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0,
            maxOutputTokens: 1500
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const json = await response.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    case 'openrouter': {
      const url = customEndpoint || 'https://openrouter.ai/api/v1/chat/completions';
      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://graceplace.org',
          'X-Title': 'Grace Place Report Platform'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0,
          max_tokens: 1500,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
      }

      const json = await response.json();
      return json.choices?.[0]?.message?.content || '';
    }

    case 'nvidia': {
      const url = customEndpoint || 'https://integrate.api.nvidia.com/v1/chat/completions';
      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0,
          max_tokens: 1500,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NVIDIA NIM API error (${response.status}): ${errorText}`);
      }

      const json = await response.json();
      return json.choices?.[0]?.message?.content || '';
    }

    case 'anthropic':
    default: {
      // Default to Anthropic Claude
      const url = customEndpoint || 'https://api.anthropic.com/v1/messages';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          temperature: 0,
          system: systemInstruction || 'Return only a valid JSON object. No explanation, no conversational filler, and no markdown formatting.',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      const json = await response.json();
      return json.content?.[0]?.text || '';
    }
  }
}

/**
 * 1. AI Per-Report Summarisation
 */
export async function summarizeReport(unitName: string, monthYear: string, reportText: string): Promise<any> {
  const prompt = `You are an assistant to a church administrator. You have received a monthly report from the ${unitName} department for ${monthYear}.

Analyse the report and return a JSON object with exactly this structure:
{
  "summary": "2–3 sentence overview of the report",
  "breakthroughs": ["array of key achievements or positive outcomes"],
  "issues": ["array of challenges or problems reported"],
  "progress": ["array of ongoing activities or updates"],
  "critical_alerts": ["urgent matters requiring immediate leadership attention — empty array if none"],
  "completeness_score": <integer 1–5>
}

Scoring guide for completeness_score:
5 = Thorough, covers multiple sections with detail
4 = Good coverage, minor gaps
3 = Adequate but sparse in some areas
2 = Very brief or missing key sections
1 = Essentially empty or uninformative

Return only the JSON object. No markdown, no explanation.

Report text:
${reportText}`;

  const responseText = await callLLM(prompt);
  return cleanAndParseJSON(responseText);
}

/**
 * 2. Cross-Unit Monthly Summary
 */
export async function summarizeMonthly(monthYear: string, unitSummaries: any[]): Promise<any> {
  const prompt = `You are an assistant to a church administrator. Below are AI-parsed summaries of monthly reports from all church units for ${monthYear}.

Analyse across all units and return a JSON object with exactly this structure:
{
  "overall_summary": "A narrative paragraph summarising the month across all units",
  "common_issues": ["Issues mentioned by 2 or more units"],
  "common_breakthroughs": ["Achievements shared or reflected across multiple units"],
  "critical_alerts": ["Any urgent matters from any unit requiring immediate attention"],
  "cross_unit_themes": ["Notable patterns, dependencies, or recurring themes across units"],
  "unit_highlights": [{ "unit_name": "...", "highlight": "one-sentence highlight" }]
}

Return only the JSON object. No markdown, no explanation.

Unit summaries (JSON array):
${JSON.stringify(unitSummaries, null, 2)}`;

  const responseText = await callLLM(prompt);
  return cleanAndParseJSON(responseText);
}

/**
 * 3. Per-Unit Trend Analysis (6-month history)
 */
export async function analyzeTrend(unitName: string, chronologicalSummaries: any[]): Promise<any> {
  const prompt = `You are analysing the report history for the ${unitName} department of a church.
Below are AI summaries for the past ${chronologicalSummaries.length} months in chronological order (oldest first).

Return a JSON object with exactly this structure:
{
  "trend_narrative": "A paragraph describing the unit's overall progress trajectory",
  "persisting_issues": ["Issues that appear in 2 or more consecutive months"],
  "resolved_issues": ["Issues that appeared previously but are absent in recent months"],
  "new_developments": ["Things appearing for the first time in the most recent report"],
  "momentum": "positive | neutral | concerning"
}

Return only the JSON object. No markdown, no explanation.

Monthly summaries:
${JSON.stringify(chronologicalSummaries, null, 2)}`;

  const responseText = await callLLM(prompt);
  return cleanAndParseJSON(responseText);
}
