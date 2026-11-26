"use strict";(()=>{var e={};e.id=744,e.ids=[744],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},8842:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>$,patchFetch:()=>y,requestAsyncStorage:()=>h,routeModule:()=>m,serverHooks:()=>g,staticGenerationAsyncStorage:()=>f});var r={};a.r(r),a.d(r,{POST:()=>d,dynamic:()=>c,runtime:()=>p});var i=a(9303),s=a(8716),o=a(670),n=a(4992);let l=`You are Nitin Shukla's official portfolio AI assistant, represented by his custom red mascot.
Your job is to answer questions from recruiters, engineering managers, fellow developers, and collaborators accurately, concisely, and professionally.

=======================================================
NITIN SHUKLA — AUTHORITATIVE PROFILE DATA
=======================================================
Name: ${n.c.personal.name}
Role: ${n.c.personal.role}
Title: ${n.c.personal.title}
Location: ${n.c.personal.location}
Origin: ${n.c.personal.origin}
Timezone: ${n.c.personal.timezone}
Status: ${n.c.personal.statusText} (Actively available for 2025/2026 roles)
Bio: ${n.c.personal.shortBio}
Summary: ${n.c.personal.aboutBio1} ${n.c.personal.aboutBio2}

-------------------------------------------------------
CONTACT & SOCIAL PROFILES
-------------------------------------------------------
Email: ${n.c.personal.email}
GitHub: ${n.K.github} (@IamNitinShukla)
LinkedIn: ${n.K.linkedin}
Twitter/X: ${n.K.twitter} (@woonitin)
Resume: ${n.c.personal.resumeUrl}

-------------------------------------------------------
ENGINEERING PHILOSOPHY (HOW NITIN BUILDS)
-------------------------------------------------------
${n.c.philosophy.quote}
Pillars:
1. Simple: Easy to read, easy to delete. Zero tolerance for unearned complexity or resume-driven architectural bloat.
2. Fast: Speed is respect. Sub-second response times, streaming token responses, and instantaneous client interactions.
3. Useful: AI only where it solves genuine bottlenecks. Real utility triumphs over speculative tech demos every time.
4. Crafted: Deterministic error states, tactile feedback, and interfaces that feel effortless.

-------------------------------------------------------
CORE SKILLS & TECHNOLOGIES
-------------------------------------------------------
Tech Marquee: ${n.c.techMarquee.join(", ")}

Categorized Skills:
${n.c.skillCategories.map(e=>`• ${e.name} (${e.description}):
  `+e.skills.map(e=>`${e.name} [${e.level||"Proficient"}${e.featured?" \xb7 Featured":""}]`).join(", ")).join("\n")}

-------------------------------------------------------
FEATURED PROJECTS & SYSTEMS
-------------------------------------------------------
${n.c.projects.map(e=>`Project: ${e.title} (${e.category})
Kicker: ${e.kicker}
Short Description: ${e.shortDescription}
Detailed Architecture: ${e.fullDescription}
Tech Stack: ${e.techStack.join(", ")}
Key Metrics: ${e.metrics.map(e=>`${e.label}: ${e.value}`).join(" | ")}
Highlights:
${e.highlights.map(e=>`  - ${e}`).join("\n")}
Links: GitHub (${e.githubUrl}) | Demo (${e.liveDemoUrl})`).join("\n\n")}

-------------------------------------------------------
WORK & LEADERSHIP EXPERIENCE
-------------------------------------------------------
${n.c.experience.map(e=>`Role: ${e.role}
Organization: ${e.organization} (${e.employmentType})
Period & Location: ${e.period} | ${e.location}
Description: ${e.description}
Technologies: ${e.technologies.join(", ")}
Key Achievements:
${e.achievements.map(e=>`  - ${e}`).join("\n")}`).join("\n\n")}

-------------------------------------------------------
EDUCATION & COURSEWORK
-------------------------------------------------------
Degree: ${n.c.education.degree}
Specialization: ${n.c.education.specialization}
Institution: ${n.c.education.institution}
Period: ${n.c.education.period}
Grade: ${n.c.education.grade}
Summary: ${n.c.education.summary}
Relevant Coursework: ${n.c.education.coursework.join(", ")}

-------------------------------------------------------
ACHIEVEMENTS & CERTIFICATIONS
-------------------------------------------------------
${n.c.achievements.map(e=>`• ${e.title} (${e.issuer}, ${e.date}) [${e.badge||e.category}]:
  ${e.description}`).join("\n")}

=======================================================
STRICT BEHAVIORAL & RESPONSE GUIDELINES
=======================================================
1. STRICT GROUNDING: All facts about Nitin's experience, projects, skills, education, and links must be sourced directly from the profile data above.
2. MISSING INFORMATION / HALLUCINATION PREVENTION: If asked about details not listed (e.g. personal phone number, private physical address, unmentioned hobbies, unlisted companies, or private salary history), DO NOT guess or fabricate. Say clearly and politely:
   "That information isn't mentioned in Nitin's portfolio. For direct inquiries, feel free to reach out via his Contact section or email him at ${n.c.personal.email}."
3. CONVERSATIONAL MEMORY & COREFERENCE RESOLUTION: You will receive recent chat turns. Accurately resolve pronouns like 'it', 'they', 'that project', 'his role', or follow-ups referencing earlier statements.
4. COMPARISONS & SYSTEM SYNTHESIS: When asked to compare projects (e.g., LexGenAI vs. Krishi-Setu or RookDB), highlight concrete architectural differences, tech stacks, and domain goals from the data.
5. CONCISE, CLEAN FORMATTING: Keep answers readable for a compact chat panel. Use concise paragraphs, bullet points, and markdown bolding where helpful. Avoid massive walls of text unless the user specifically asks for exhaustive technical details.
6. TONE: Professional, articulate, technically sound, humble, and helpful. You speak as Nitin's dedicated AI assistant.`,c="force-dynamic",p="nodejs",u=new Map;async function d(e){let t;let a=process.env.GEMINI_API_KEY;if(!a||""===a.trim())return Response.json({error:"Gemini API key is not configured on the server.",fallbackAvailable:!0},{status:503});if(function(e){let t=parseInt(process.env.GEMINI_RATE_LIMIT_RPM||"",10)||25,a=Date.now(),r=u.get(e)||{timestamps:[]};return r.timestamps=r.timestamps.filter(e=>a-e<6e4),r.timestamps.length>=t||(r.timestamps.push(a),u.set(e,r),u.size>1e3&&u.forEach((e,t)=>{(0===e.timestamps.length||a-e.timestamps[e.timestamps.length-1]>6e4)&&u.delete(t)}),!1)}(e.headers.get("x-forwarded-for")?.split(",")[0].trim()||e.headers.get("x-real-ip")||"127.0.0.1"))return Response.json({error:"Rate limit exceeded. Please wait a moment before sending another message.",fallbackAvailable:!0},{status:429});try{t=await e.json()}catch{return Response.json({error:"Invalid JSON request payload."},{status:400})}let{message:r,history:i}=t;if("string"!=typeof r||0===r.trim().length)return Response.json({error:"Message must be a non-empty string."},{status:400});let s=r.trim();if(s.length>1e3)return Response.json({error:"Message exceeds maximum allowed length of 1000 characters."},{status:400});let o=[];if(Array.isArray(i))for(let e of i.slice(-8))e&&"object"==typeof e&&"string"==typeof e.text&&e.text.trim().length>0&&("user"===e.sender||"assistant"===e.sender)&&o.push({role:"user"===e.sender?"user":"model",parts:[{text:e.text.trim().substring(0,1e3)}]});o.push({role:"user",parts:[{text:s}]});let n=process.env.GEMINI_MODEL||"gemini-3.8-flash",c=[n,...["gemini-3.1-flash-lite","gemini-2.5-flash-lite"].filter(e=>e!==n)],p={systemInstruction:{parts:[{text:l}]},contents:o,generationConfig:{temperature:.3,maxOutputTokens:600,topP:.95}},d=null,m=n;for(let e of c)try{let t=`https://generativelanguage.googleapis.com/v1beta/models/${e}:streamGenerateContent?alt=sse&key=${a}`,r=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p),signal:AbortSignal.timeout(15e3)});if(r.ok&&r.body){d=r,m=e;break}if(503===r.status||404===r.status)continue;d=r,m=e;break}catch(e){if("TimeoutError"===e.name)continue}if(!d||!d.ok||!d.body){let e=d?d.status:504;return Response.json({error:"Upstream AI model unavailable. Safe fallback is available.",status:e,fallbackAvailable:!0},{status:e>=400&&e<600?e:502})}let h=d.body.getReader(),f=new TextDecoder,g=new TextEncoder,$="";return new Response(new ReadableStream({async start(e){try{for(;;){let{done:t,value:a}=await h.read();if(t){e.enqueue(g.encode(`data: ${JSON.stringify({done:!0,model:m})}

`)),e.close();break}let r=($+=f.decode(a,{stream:!0})).split("\n");for(let t of($=r.pop()||"",r)){let a=t.trim();if(a.startsWith("data: ")){let t=a.slice(6);try{let a=JSON.parse(t),r=a.candidates?.[0]?.content?.parts?.[0]?.text;r&&e.enqueue(g.encode(`data: ${JSON.stringify({text:r})}

`))}catch{}}}}}catch(t){e.error(t)}finally{try{h.releaseLock()}catch{}}},cancel(){try{h.cancel()}catch{}}}),{headers:{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-cache, no-transform",Connection:"keep-alive","X-Model-Used":m}})}let m=new i.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/chat/route",pathname:"/api/chat",filename:"route",bundlePath:"app/api/chat/route"},resolvedPagePath:"C:\\Users\\WorkSpace\\Desktop\\WorkSpace\\Portfolio\\src\\app\\api\\chat\\route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:h,staticGenerationAsyncStorage:f,serverHooks:g}=m,$="/api/chat/route";function y(){return(0,o.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:f})}},9303:(e,t,a)=>{e.exports=a(517)}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[948,992],()=>a(8842));module.exports=r})();