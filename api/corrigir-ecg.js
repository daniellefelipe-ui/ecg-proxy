const GABARITO = {
  1:  { componentes: ["ritmo sinusal", "bloqueio de ramo direito", "sobrecarga atrial esquerda"] },
  2:  { componentes: ["ritmo atrial multifocal"] },
  3:  { componentes: ["ritmo sinusal", "bloqueio atrioventricular de segundo grau mobitz i", "bloqueio de ramo direito"] },
  4:  { componentes: ["ritmo sinusal", "area eletrica inativa inferior", "alteracao de repolarizacao inferolateral"] },
  5:  { componentes: ["ritmo sinusal", "supradesnivelamento de segmento st parede inferolateral", "imagem em espelho"] },
  6:  { componentes: ["troca de eletrodos"] },
  7:  { componentes: ["bloqueio atrioventricular 2:1", "bloqueio de ramo esquerdo"] },
  8:  { componentes: ["bloqueio atrioventricular total", "bloqueio de ramo direito", "bloqueio divisional anterossuperior esquerdo"] },
  9:  { componentes: ["taquicardia supraventricular"] },
  10: { componentes: ["ritmo juncional bradicardico"] },
  11: { componentes: ["taquicardia sinusal", "sobrecarga ventricular esquerda"] },
  12: { componentes: ["ritmo sinusal", "disturbio de conducao pelo ramo direito", "bloqueio divisional anterossuperior esquerdo"] },
  13: { componentes: ["marcapasso modo aai", "bloqueio de ramo esquerdo"] },
  14: { componentes: ["fibrilacao atrial", "marcapasso ventricular vvi"] },
  15: { componentes: ["marcapasso modo vvi"] },
  16: { componentes: ["ritmo sinusal para os atrios", "marcapasso ventricular vvi"] },
  17: { componentes: ["fibrilacao atrial", "sobrecarga ventricular esquerda"] },
  18: { componentes: ["ritmo sinusal", "area eletrica inativa anterior", "area eletrica inativa inferior", "sobrecarga ventricular esquerda"] },
  19: { componentes: ["ritmo sinusal", "dentro dos limites da normalidade"] },
  20: { componentes: ["marcapasso modo aai", "sobrecarga ventricular esquerda"] },
  21: { componentes: ["velocidade incorreta 50mm/s"] },
  22: { componentes: ["bloqueio atrioventricular total"] },
  23: { componentes: ["ritmo sinusal", "pre-excitacao ventricular intermitente"] },
  24: { componentes: ["taquicardia ventricular"] },
  25: { componentes: ["flutter atrial", "intervalo qtc prolongado"] },
  26: { componentes: ["taquicardia supraventricular por reentrada nodal"] },
  27: { componentes: ["ritmo sinusal", "dentro da normalidade para a idade"] },
  28: { componentes: ["ritmo sinusal", "sobrecarga biatrial"] },
  29: { componentes: ["ritmo sinusal", "extrassistole ventricular"] },
  30: { componentes: ["mobitz i tem alargamento progressivo do pr", "mobitz ii tem bloqueio subito com pr fixo"] },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { questao, resposta } = req.body;

  if (!questao || resposta === undefined) {
    return res.status(400).json({ error: "Campos 'questao' e 'resposta' são obrigatórios" });
  }

  const gabarito = GABARITO[questao];
  if (!gabarito) {
    return res.status(400).json({ error: `Questão ${questao} não encontrada no gabarito` });
  }

  const componentes = gabarito.componentes;
  const pesoUnitario = 1 / componentes.length;

  const prompt = `Você é um avaliador especialista em eletrocardiografia médica.

Avalie se a resposta do candidato contém cada um dos componentes do gabarito.

COMPONENTES DO GABARITO:
${componentes.map((c, i) => `${i + 1}. ${c}`).join("\n")}

RESPOSTA DO CANDIDATO:
"${resposta}"

INSTRUÇÕES:
- Considere sinônimos, abreviações e variações de escrita como corretos (ex: "BRD" = "bloqueio de ramo direito", "RS" = "ritmo sinusal", "FA" = "fibrilação atrial", "SAE" = "sobrecarga atrial esquerda", "SVE" = "sobrecarga ventricular esquerda", "BAVT" = "bloqueio atrioventricular total", "TV" = "taquicardia ventricular", "MP" = "marcapasso", etc.)
- Seja generoso com variações linguísticas desde que o conceito esteja correto
- Responda APENAS com um JSON no formato abaixo, sem nenhum texto adicional:

{
  "componentes": [
    { "descricao": "componente 1", "presente": true },
    { "descricao": "componente 2", "presente": false }
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erro na API do Claude');

    const text = data.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta do Claude sem JSON válido');

    const resultado = JSON.parse(jsonMatch[0]);
    const pontosGanhos = resultado.componentes.filter((c) => c.presente).length;
    const nota = parseFloat((pontosGanhos * pesoUnitario).toFixed(4));

    return res.status(200).json({
      questao,
      nota,
      total_componentes: componentes.length,
      componentes: resultado.componentes,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao processar correção', detalhe: err.message });
  }
}
