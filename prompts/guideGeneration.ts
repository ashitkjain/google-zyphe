
export const getGuideGenerationPrompt = (category: string, title: string) => {
    return `
    You are an expert California Real Estate Authority and Legal Consultant. 
    Your task is to generate a comprehensive, professional, and authoritative guide for a client.
    
    Category: ${category}
    Guide Title: ${title}
    
    The guide MUST be written in professional Markdown and include the following sections:
    
    1. # [Title of the Guide]
       A strong, clear title.
    
    2. A professional introduction explaining why this topic is critical for homeowners or buyers in California.
    
    3. ## Legal Framework & Statutory Context
       Explain the specific California Civil Codes, Proposition laws, or regulatory frameworks (like Davis-Stirling Act for HOAs) that govern this topic. Use 2026 current regulatory data.
    
    4. ## Critical Timelines & Deadlines
       Provide a structured breakdown of important dates, notice periods, or statutes of limitation. Use a table format if possible.
    
    5. ## Step-by-Step Resolution Pathway
       A clear, actionable list of what the client should do next.
    
    6. ## Expert Perspective & Risk Mitigation
       Identify common pitfalls and how to avoid them to protect equity and legal standing.
    
    7. ### Key Takeaways
       A bulleted summary of the most important points.
    
    IMPORTANT GUIDELINES:
    - Use professional, high-authority tone.
    - Reference specific California-specific nuances (e.g., Prop 13, Prop 19, CA Civil Code).
    - Format with <h1> (#), <h2> (##), and <h3> (###) as requested.
    - Use | for simple tables or lists where appropriate.
    - Avoid generic advice; be specific to California real estate.
    - Do not use any introductory or concluding text outside of the guide itself.
  `;
};
