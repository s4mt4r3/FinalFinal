import { describe, expect, it } from 'vitest';
import { renderHtml, renderLatex, renderText } from '@/lib/resume-render';
import { ALL_KINDS, composition, sampleData, texBraceBalance } from '../helpers/fixtures';

const XSS = `<img src=x onerror="alert('x')">`;

describe('renderHtml', () => {
  it('renders a full composition with every section title and value', () => {
    const html = renderHtml(composition(ALL_KINDS));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    for (const t of ['Education', 'Relevant Coursework', 'Experience', 'Projects', 'Technical Skills', 'Leadership / Extracurricular']) {
      expect(html).toContain(`<h2>${t}</h2>`);
    }
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Analytical Engines Ltd');
    expect(html).toContain('<span class="cat">Languages</span>: English, French, Italian');
  });

  it('renders the header first regardless of its position, then body sections in composition order', () => {
    const html = renderHtml(composition(['skills', 'experience', 'header', 'education']));
    const at = (s: string) => html.indexOf(s);
    expect(at('class="head"')).toBeGreaterThan(-1);
    expect(at('class="head"')).toBeLessThan(at('<h2>Technical Skills</h2>'));
    expect(at('<h2>Technical Skills</h2>')).toBeLessThan(at('<h2>Experience</h2>'));
    expect(at('<h2>Experience</h2>')).toBeLessThan(at('<h2>Education</h2>'));
  });

  it('applies the scale knob to the body font size', () => {
    expect(renderHtml(composition(['header']))).toContain('font-size: 10.600pt');
    expect(renderHtml(composition(['header']), { scale: 0.5 })).toContain('font-size: 5.300pt');
    expect(renderHtml(composition(['header']), { scale: 0.873 })).toContain('font-size: 9.254pt');
  });

  it('escapes HTML in every user-controlled field', () => {
    const html = renderHtml(
      composition(['header', 'experience', 'skills', 'coursework', 'projects'], {
        header: { name: XSS, email: XSS, location: XSS },
        experience: { items: [{ company: XSS, title: XSS, dateRange: XSS, location: XSS, bullets: [XSS] }] },
        skills: { categories: [{ category: XSS, items: XSS }] },
        coursework: { courses: [XSS] },
        projects: { items: [{ name: XSS, tech: XSS, date: XSS, bullets: [XSS] }] },
      })
    );
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/onerror="/);
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  });

  it('escapes a custom section title', () => {
    const html = renderHtml([{ kind: 'skills', title: '<b>Skills</b>', data: sampleData.skills }]);
    expect(html).toContain('<h2>&lt;b&gt;Skills&lt;/b&gt;</h2>');
  });

  it('drops blank bullets and blank skill rows', () => {
    const html = renderHtml(composition(['experience', 'skills']));
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html.match(/class="line"/g)).toHaveLength(1);
  });

  it('handles empty compositions and empty sections without throwing', () => {
    expect(() => renderHtml([])).not.toThrow();
    const html = renderHtml(
      composition(['education', 'experience', 'projects', 'skills', 'coursework', 'leadership'], {
        education: { items: [] },
        experience: {},
        projects: { items: [] },
        skills: {},
        coursework: { courses: [] },
        leadership: { items: [] },
      })
    );
    expect(html).not.toContain('undefined');
    expect(html).toContain('<div class="coursework"></div>');
  });

  it('omits missing optional header fields cleanly', () => {
    const html = renderHtml(composition(['header'], { header: { name: 'Only Name' } }));
    expect(html).toContain('Only Name');
    expect(html).not.toContain('class="addr"');
    expect(html).not.toContain('class="contact"');
    expect(html).not.toContain('undefined');
  });

  it('falls back to a placeholder name when the header name is empty', () => {
    expect(renderHtml(composition(['header'], { header: { name: '' } }))).toContain('Your Name');
  });

  it('splits coursework into at most four columns, preserving order', () => {
    const courses = Array.from({ length: 9 }, (_, i) => `C${i}`);
    const html = renderHtml(composition(['coursework'], { coursework: { courses } }));
    const cols = html.match(/<ul>(.*?)<\/ul>/g)!;
    expect(cols.length).toBeLessThanOrEqual(4);
    const flat = cols.join('').match(/C\d/g);
    expect(flat).toEqual(courses);
  });

  it('passes unicode through untouched', () => {
    const name = 'José Müller — 李小龍 🚀';
    expect(renderHtml(composition(['header'], { header: { name } }))).toContain(name);
  });

  it('renders very long text without truncation', () => {
    const long = 'word '.repeat(5000).trim();
    const html = renderHtml(composition(['experience'], { experience: { items: [{ company: 'A', bullets: [long] }] } }));
    expect(html).toContain(long);
  });
});

describe('renderLatex', () => {
  it('produces a complete, brace-balanced Jake document', () => {
    const tex = renderLatex(composition(ALL_KINDS));
    expect(tex).toContain('\\documentclass[letterpaper,11pt]{article}');
    expect(tex).toContain('\\begin{document}');
    expect(tex.trimEnd().endsWith('\\end{document}')).toBe(true);
    expect(texBraceBalance(tex)).toBe(0);
    for (const t of ['Education', 'Relevant Coursework', 'Experience', 'Projects', 'Technical Skills', 'Leadership / Extracurricular']) {
      expect(tex).toContain(`\\section{${t}}`);
    }
    expect(tex).toContain('{\\Huge \\scshape Ada Lovelace}');
    expect(tex).toContain('\\resumeItem{Wrote the first published algorithm}');
  });

  it('keeps body sections in composition order after the header', () => {
    const tex = renderLatex(composition(['projects', 'header', 'education']));
    expect(tex.indexOf('\\begin{center}')).toBeLessThan(tex.indexOf('\\section{Projects}'));
    expect(tex.indexOf('\\section{Projects}')).toBeLessThan(tex.indexOf('\\section{Education}'));
  });

  it('escapes LaTeX special characters in user text', () => {
    const tex = renderLatex(
      composition(['experience'], {
        experience: { items: [{ company: 'R&D 100% $5 #1 a_b {x}', title: '~^', dateRange: '', location: '', bullets: [] }] },
      })
    );
    expect(tex).toContain('R\\&D 100\\% \\$5 \\#1 a\\_b \\{x\\}');
    expect(tex).toContain('\\textasciitilde{}\\textasciicircum{}');
    expect(texBraceBalance(tex)).toBe(0);
  });

  // BUG: latexEsc replaces "\" with "\textbackslash{}" first and then escapes
  // the braces it just inserted, yielding "\textbackslash\{\}" which prints "\{}".
  it('escapes a backslash as \\textbackslash{} (not \\textbackslash\\{\\})', () => {
    const tex = renderLatex(composition(['skills'], { skills: { categories: [{ category: 'Paths', items: 'C:\\Users' }] } }));
    expect(tex).toContain('C:\\textbackslash{}Users');
    expect(tex).not.toContain('\\textbackslash\\{\\}');
  });

  // BUG: header URLs go into \href{...} unescaped. A URL-encoded LinkedIn slug
  // (e.g. a name with an accent) contains "%", which TeX treats as a comment,
  // swallowing the closing braces and breaking compilation.
  it('keeps \\href targets compilable when contact URLs contain % or #', () => {
    const tex = renderLatex(
      composition(['header'], {
        header: { name: 'José', linkedin: 'linkedin.com/in/jos%C3%A9', website: 'site.dev/#about', email: 'a_b@x.com' },
      })
    );
    expect(texBraceBalance(tex)).toBe(0);
  });

  it('does not emit "undefined" for missing optional fields', () => {
    const tex = renderLatex(
      composition(['header', 'experience', 'projects'], {
        header: { name: 'Only Name' },
        experience: { items: [{ company: 'Acme' }] },
        projects: { items: [{ name: 'P' }] },
      })
    );
    expect(tex).not.toContain('undefined');
    expect(tex).not.toContain('\\faPhone');
    expect(texBraceBalance(tex)).toBe(0);
  });

  it('omits empty skill rows and joins the rest with line breaks', () => {
    const tex = renderLatex(composition(['skills'], {
      skills: { categories: [{ category: 'A', items: '1' }, { category: '', items: '' }, { category: 'B', items: '2' }] },
    }));
    expect(tex).toContain('\\textbf{A}{: 1} \\\\');
    expect(tex).toMatch(/\\textbf\{B\}\{: 2\}\n/);
  });

  it('handles an empty composition', () => {
    const tex = renderLatex([]);
    expect(tex).toContain('\\begin{document}');
    expect(texBraceBalance(tex)).toBe(0);
  });

  it('passes unicode through', () => {
    expect(renderLatex(composition(['header'], { header: { name: 'Zoë 李' } }))).toContain('Zoë 李');
  });
});

describe('renderText', () => {
  it('renders a plain-text resume with uppercase section headings and bullets', () => {
    const txt = renderText(composition(ALL_KINDS));
    expect(txt).toContain('Ada Lovelace');
    expect(txt).toContain('London, UK | 555-0100 | ada@example.com');
    expect(txt).toContain('EXPERIENCE\n' + '-'.repeat(78));
    expect(txt).toContain('  • Wrote the first published algorithm');
    expect(txt).toContain('Analysis, Algebra, Logic, Mechanics, Probability');
    expect(txt).toContain('Languages: English, French, Italian');
    expect(txt).not.toContain('•  \n');
  });

  it('right-aligns dates within 78 columns and falls back to two spaces when too long', () => {
    const txt = renderText(composition(['experience'], {
      experience: { items: [{ company: 'Acme', title: 'Eng', dateRange: '2020', location: 'NYC', bullets: [] }] },
    }));
    const row = txt.split('\n').find((l) => l.startsWith('Acme'))!;
    expect(row).toHaveLength(78);
    expect(row.endsWith('2020')).toBe(true);

    const long = 'X'.repeat(80);
    const txt2 = renderText(composition(['experience'], {
      experience: { items: [{ company: long, title: '', dateRange: '2020', location: '', bullets: [] }] },
    }));
    expect(txt2).toContain(`${long}  2020`);
  });

  it('handles an empty composition', () => {
    expect(renderText([])).toBe('');
  });

  // BUG: txtRow() calls left.length, so an item that has a date but no
  // company/school throws and turns the whole save into a 500; "  " + undefined
  // also leaks the literal word "undefined" into the content cache.
  it('tolerates items with missing fields', () => {
    const comp = composition(['education', 'experience', 'leadership', 'projects'], {
      education: { items: [{ dateRange: '2020' }] },
      experience: { items: [{ dateRange: '2021', bullets: ['did things'] }] },
      leadership: { items: [{ dateRange: '2022' }] },
      projects: { items: [{ date: '2023' }] },
    });
    let txt = '';
    expect(() => {
      txt = renderText(comp);
    }).not.toThrow();
    expect(txt).not.toContain('undefined');
    expect(txt).toContain('did things');
  });

  it('omits missing optional header fields', () => {
    const txt = renderText(composition(['header'], { header: { name: 'Only Name' } }));
    expect(txt.trim()).toBe('Only Name');
  });
});
