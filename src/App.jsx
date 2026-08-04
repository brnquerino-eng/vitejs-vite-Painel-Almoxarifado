import React, { useState, useEffect, useMemo, useCallback } from "react";
import Papa from "papaparse";
import {
  ShoppingCart,
  Filter,
  X,
  Boxes,
  RefreshCw,
  SlidersHorizontal,
  Building2,
  Calendar,
  TrendingDown
} from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 10);

const nomesMeses = {
  "1": "Janeiro", "01": "Janeiro",
  "2": "Fevereiro", "02": "Fevereiro",
  "3": "Março", "03": "Março",
  "4": "Abril", "04": "Abril",
  "5": "Maio", "05": "Maio",
  "6": "Junho", "06": "Junho",
  "7": "Julho", "07": "Julho",
  "8": "Agosto", "08": "Agosto",
  "9": "Setembro", "09": "Setembro",
  "10": "Outubro",
  "11": "Novembro",
  "12": "Dezembro"
};

const brl = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

// Buscador flexível de colunas
const findFuzzyKey = (obj, possibleNames) => {
  const keys = Object.keys(obj);
  for (let name of possibleNames) {
    const match = keys.find(k => String(k).trim().toLowerCase() === String(name).toLowerCase());
    if (match && obj[match] !== undefined && obj[match] !== null && String(obj[match]).trim() !== "") {
      return obj[match];
    }
  }
  return null;
};

// Parser inteligente para formatos brasileiros (ex: 332.483.344,19)
const parseBrNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  
  let str = String(val).replace(/R\$/g, '').trim();
  if (!str) return 0;

  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  if (lastComma > lastDot) {
    str = str.replace(/\./g, '');
    str = str.replace(',', '.');
  } else if (lastDot > lastComma) {
    str = str.replace(/,/g, '');
  } else if (lastComma !== -1 && lastDot === -1) {
    str = str.replace(',', '.');
  }

  const num = Number(str);
  return isNaN(num) ? 0 : num;
};

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState([]);
  const [compras, setCompras] = useState([]);
  const [consumo, setConsumo] = useState([]);
  
  const [catFilter, setCatFilter] = useState("Todas");
  const [unitFilter, setUnitFilter] = useState("Todas");
  const [yearFilter, setYearFilter] = useState("Todas");
  const [monthFilter, setMonthFilter] = useState("Todas");
  
  const [showParameters, setShowParameters] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoaded(false);
    setSaveError(false);

    try {
      const noCacheUrl = `/Base.csv?t=${new Date().getTime()}`;
      const response = await fetch(noCacheUrl);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status} - Arquivo não encontrado.`);
      }
      
      const csvText = await response.text();
      const detectedDelimiter = (csvText.includes(';') && (csvText.split(';').length > csvText.split(',').length)) ? ';' : ',';

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        delimiter: detectedDelimiter,
        complete: (resultados) => {
          const linhas = resultados.data;
          const newItems = [];
          const newCompras = [];
          const newConsumo = [];

          linhas.forEach((linha) => {
            const id = uid();
            const valores = Object.values(linha);
            
            // 🎯 Captura Mês (Coluna A / Índice 0) e Ano (Coluna B / Índice 1) separadamente
            let rawMes = valores.length >= 1 && valores[0] !== undefined ? String(valores[0]).trim() : "1";
            let rawAno = valores.length >= 2 && valores[1] !== undefined ? String(valores[1]).trim() : "2026";
            
            // Padroniza mês para garantir formato com 2 dígitos internos (ex: "1" vira "01")
            const itemMonth = rawMes.padStart(2, '0');
            const itemYear = rawAno;

            // 🎯 Captura Unidade (Coluna C / Índice 2)
            let unidadeAtrelada = "Não Definida";
            if (valores.length >= 3 && valores[2] !== undefined && String(valores[2]).trim() !== "") {
              unidadeAtrelada = String(valores[2]).trim();
            } else {
              const foundUnit = findFuzzyKey(linha, ['Unidade_Almoxarifado', 'Unidade', 'Almoxarifado']);
              if (foundUnit) unidadeAtrelada = String(foundUnit).trim();
            }

            const category = findFuzzyKey(linha, ['Categoria', 'Grupo']) || "Geral";
            
            const qtyAtual = parseBrNumber(findFuzzyKey(linha, ['Qtde_Saldo_Atual', 'Saldo', 'Quantidade', 'Qtde_Estoque']));
            const valorAtual = parseBrNumber(findFuzzyKey(linha, ['Valor_Saldo_Atual', 'Valor', 'Custo', 'Valor_Total', 'Valor_Estoque']));
            
            const unitCost = qtyAtual > 0 ? (valorAtual / qtyAtual) : 0;

            newItems.push({
              id,
              category,
              unitCost,
              unidadeAlmoxarifado: unidadeAtrelada,
              currentStock: qtyAtual,
              valorTotalPreCalculado: valorAtual,
              month: itemMonth,
              year: itemYear
            });

            const qtyCompras = parseBrNumber(findFuzzyKey(linha, ['Qtde_Entrada_Compras', 'Entrada', 'Compras', 'Qtde_Compra']));
            if (qtyCompras > 0) {
              newCompras.push({ id: uid(), itemId: id, month: itemMonth, year: itemYear, qty: qtyCompras, unitCost, unidadeAlmoxarifado: unidadeAtrelada });
            }

            const qtyConsumo = parseBrNumber(findFuzzyKey(linha, ['Qtde_Saida_Cons_Interno', 'Saida', 'Consumo', 'Qtde_Consumo', 'Saida_Consumo']));
            if (qtyConsumo > 0) {
              newConsumo.push({ id: uid(), itemId: id, month: itemMonth, year: itemYear, qty: qtyConsumo, unitCost, unidadeAlmoxarifado: unidadeAtrelada });
            }
          });

          setItems(newItems);
          setCompras(newCompras);
          setConsumo(newConsumo);
          setLoaded(true);
        },
        error: (erro) => {
          console.error("Erro ao processar as colunas no PapaParse:", erro);
          setSaveError(true);
          setLoaded(true);
        }
      });
    } catch (erro) {
      console.error("Erro crítico ao carregar o arquivo local:", erro);
      setSaveError(true);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const availableUnits = useMemo(() => {
    const unitsSet = new Set(
      items
        .map(i => i.unidadeAlmoxarifado)
        .filter(u => u && u !== "Não Definida" && u.trim() !== "")
    );
    return Array.from(unitsSet).sort();
  }, [items]);

  const availableYears = useMemo(() => {
    const yearsSet = new Set(
      [...items.map(i => i.year), ...compras.map(c => c.year), ...consumo.map(c => c.year)].filter(Boolean)
    );
    return Array.from(yearsSet).sort().reverse();
  }, [items, compras, consumo]);

  const availableMonths = useMemo(() => {
    const monthsSet = new Set(
      [...items.map(i => i.month), ...compras.map(c => c.month), ...consumo.map(c => c.month)].filter(Boolean)
    );
    return Array.from(monthsSet).sort();
  }, [items, compras, consumo]);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))),
    [items]
  );

  const filteredCompras = useMemo(() => {
    return compras.filter(c => 
      (yearFilter === "Todas" || c.year === yearFilter) &&
      (monthFilter === "Todas" || c.month === monthFilter) &&
      (unitFilter === "Todas" || c.unidadeAlmoxarifado === unitFilter) &&
      (catFilter === "Todas" || items.find(i => i.id === c.itemId)?.category === catFilter)
    );
  }, [compras, yearFilter, monthFilter, unitFilter, catFilter, items]);

  const filteredConsumo = useMemo(() => {
    return consumo.filter(c => 
      (yearFilter === "Todas" || c.year === yearFilter) &&
      (monthFilter === "Todas" || c.month === monthFilter) &&
      (unitFilter === "Todas" || c.unidadeAlmoxarifado === unitFilter) &&
      (catFilter === "Todas" || items.find(i => i.id === c.itemId)?.category === catFilter)
    );
  }, [consumo, yearFilter, monthFilter, unitFilter, catFilter, items]);

  const stockByItem = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      if (unitFilter !== "Todas" && it.unidadeAlmoxarifado !== unitFilter) {
         map[it.id] = { current: 0, valor: 0 };
         return;
      }
      if (catFilter !== "Todas" && it.category !== catFilter) {
        map[it.id] = { current: 0, valor: 0 };
        return;
      }
      if (yearFilter !== "Todas" && it.year !== yearFilter) {
        map[it.id] = { current: 0, valor: 0 };
        return;
      }
      if (monthFilter !== "Todas" && it.month !== monthFilter) {
        map[it.id] = { current: 0, valor: 0 };
        return;
      }
      map[it.id] = { current: it.currentStock, valor: it.valorTotalPreCalculado };
    });
    return map;
  }, [items, unitFilter, catFilter, yearFilter, monthFilter]);

  const kpis = useMemo(() => {
    const activeItems = items.filter(it => 
      (unitFilter === "Todas" || it.unidadeAlmoxarifado === unitFilter) &&
      (catFilter === "Todas" || it.category === catFilter) &&
      (yearFilter === "Todas" || it.year === yearFilter) &&
      (monthFilter === "Todas" || it.month === monthFilter)
    );
    
    const valorTotalEstoque = activeItems.reduce(
      (s, it) => s + (stockByItem[it.id]?.valor || 0),
      0
    );
    
    const valorTotalCompra = filteredCompras.reduce(
      (s, c) => s + Number(c.qty || 0) * Number(c.unitCost || 0), 
      0
    );
    
    const valorTotalConsumo = filteredConsumo.reduce(
      (s, c) => s + Number(c.qty || 0) * Number(c.unitCost || 0), 
      0
    );
      
    return { valorTotalEstoque, valorTotalCompra, valorTotalConsumo };
  }, [items, stockByItem, filteredCompras, filteredConsumo, unitFilter, catFilter, yearFilter, monthFilter]);

  const activeFiltersCount = (catFilter !== "Todas" ? 1 : 0) + (unitFilter !== "Todas" ? 1 : 0) + (yearFilter !== "Todas" ? 1 : 0) + (monthFilter !== "Todas" ? 1 : 0);

  if (!loaded) {
    return (
      <div style={{ ...styles.wrap, alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <p style={{ color: "var(--paper-dim)", fontFamily: "var(--font-body)", marginTop: "20vh", textAlign: "center" }}>
          Sincronizando Base Mestre do Almoxarifado... ⏳
        </p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <GlobalStyle />
      
      <TopHeader
        onRefresh={fetchData}
        onToggleParameters={() => setShowParameters(!showParameters)}
        activeFiltersCount={activeFiltersCount}
        unitFilter={unitFilter}
      />

      {saveError && (
        <div style={styles.errorBanner}>
          Falha ao carregar o arquivo Base.csv. Verifique se o arquivo está na pasta public.
        </div>
      )}

      {showParameters && (
        <div style={styles.drawerOverlay} onClick={() => setShowParameters(false)}>
          <div style={styles.drawerPanel} onClick={(e) => e.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <div style={styles.drawerTitleContainer}>
                <SlidersHorizontal size={18} color="var(--brand-orange)" />
                <span style={styles.drawerTitle}>Parâmetros do Painel</span>
              </div>
              <button style={styles.drawerCloseBtn} onClick={() => setShowParameters(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.drawerBody}>
              <div style={styles.paramGroup}>
                <label style={styles.paramLabel}>
                  <Building2 size={14} /> Unidade de Armazenamento
                </label>
                <select
                  style={styles.select}
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                >
                  <option value="Todas">Todas as Unidades ({availableUnits.length || 0})</option>
                  {availableUnits.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div style={styles.paramGroup}>
                <label style={styles.paramLabel}>
                  <Calendar size={14} /> Ano de Referência
                </label>
                <select
                  style={styles.select}
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                >
                  <option value="Todas">Todos os Anos</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div style={styles.paramGroup}>
                <label style={styles.paramLabel}>
                  <Calendar size={14} /> Mês de Referência
                </label>
                <select
                  style={styles.select}
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                >
                  <option value="Todas">Todos os Meses (1 a 6)</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>{nomesMeses[m] || `Mês ${m}`} ({m})</option>
                  ))}
                </select>
              </div>

              <div style={styles.paramGroup}>
                <label style={styles.paramLabel}>
                  <Filter size={14} /> Categoria de Itens
                </label>
                <select
                  style={styles.select}
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                >
                  <option value="Todas">Todas as Categorias</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div style={styles.drawerFooterActions}>
                <button
                  style={styles.drawerClearBtn}
                  onClick={() => {
                    setUnitFilter("Todas");
                    setYearFilter("Todas");
                    setMonthFilter("Todas");
                    setCatFilter("Todas");
                  }}
                >
                  Limpar Parâmetros
                </button>
                <button
                  style={styles.drawerApplyBtn}
                  onClick={() => setShowParameters(false)}
                >
                  Aplicar e Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={styles.content}>
        <div style={styles.kpiGrid}>
          <KpiCard 
            label="Valor Total em Estoque" 
            value={brl(kpis.valorTotalEstoque)} 
            Icon={Boxes} 
            tone="#4FA6A1" 
          />
          <KpiCard 
            label="Valor Total de Compra" 
            value={brl(kpis.valorTotalCompra)} 
            Icon={ShoppingCart} 
            tone="#E8A23D" 
          />
          <KpiCard 
            label="Valor Total de Consumo" 
            value={brl(kpis.valorTotalConsumo)} 
            Icon={TrendingDown} 
            tone="#C7561E" 
          />
        </div>
      </div>
    </div>
  );
}

function TopHeader({ onRefresh, onToggleParameters, activeFiltersCount, unitFilter }) {
  return (
    <div style={styles.header}>
      <div style={styles.brandRow}>
        <div style={styles.logoContainer}>
          <div style={styles.logoAmbarText}>Âmbar</div>
          <div style={styles.logoEnergiaText}>ENERGIA</div>
        </div>
        
        <div style={styles.brandDivider} />

        <div>
          <div style={styles.brandTitle}>Visão Executiva de Estoque</div>
          <div style={styles.brandSub}>
            {unitFilter === "Todas" ? "Valores Consolidados" : unitFilter}
          </div>
        </div>
        
        <div style={styles.headerActions}>
          <button
            style={{
              ...styles.paramToggleBtn,
              ...(activeFiltersCount > 0 ? styles.paramToggleBtnActive : {}),
            }}
            onClick={onToggleParameters}
            title="Abrir parâmetros e filtros"
          >
            <SlidersHorizontal size={14} />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span style={styles.filterBadgeCount}>{activeFiltersCount}</span>
            )}
          </button>

          <button
            style={styles.refreshBtn}
            className="refresh-btn"
            onClick={onRefresh}
            title="Atualizar dados do painel"
          >
            <RefreshCw size={14} className="refresh-icon" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone, Icon }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiCardHeader}>
        <div style={{ ...styles.kpiIcon, background: `${tone}22`, color: tone }}>
          <Icon size={20} />
        </div>
        <div style={styles.kpiLabel}>{label}</div>
      </div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      :root {
        --ink: #14181D;
        --panel: #1D242C;
        --panel-light: #262E38;
        --paper: #E7E2D6;
        --paper-dim: #9AA0A6;
        --brand-orange: #C7561E;
        --teal: #4FA6A1;
        --rust: #C7561E;
        --line: #333B46;
        --font-display: 'Oswald', 'Arial Narrow', sans-serif;
        --font-body: 'Inter', sans-serif;
        --font-mono: 'IBM Plex Mono', monospace;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background-color: var(--ink); color: var(--paper); }
      input, select {
        background: var(--panel-light);
        border: 1px solid var(--line);
        color: var(--paper);
        border-radius: 4px;
        padding: 8px 10px;
        font-family: var(--font-body);
        font-size: 13px;
        width: 100%;
        outline: none;
      }
      input:focus, select:focus { border-color: var(--brand-orange); }
      button { font-family: var(--font-body); cursor: pointer; }

      .refresh-btn {
        transition: all 0.2s ease !important;
      }
      .refresh-btn:hover {
        background: var(--panel-light) !important;
        border-color: var(--brand-orange) !important;
        color: var(--brand-orange) !important;
      }
      .refresh-btn:hover .refresh-icon {
        transform: rotate(180deg);
        transition: transform 0.5s ease;
      }
    `}</style>
  );
}

const styles = {
  wrap: {
    background: "var(--ink)",
    color: "var(--paper)",
    fontFamily: "var(--font-body)",
    minHeight: "100vh",
    position: "relative",
  },
  header: {
    background: "var(--panel)",
    borderBottom: "3px solid var(--brand-orange)",
    padding: "16px 20px",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  logoContainer: {
    background: "#ffffff",
    padding: "6px 12px",
    borderRadius: 6,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  logoAmbarText: {
    fontFamily: "var(--font-body)",
    fontSize: 20,
    fontWeight: 700,
    color: "#2C3E50",
    letterSpacing: "-0.5px",
    lineHeight: 1.1,
  },
  logoEnergiaText: {
    fontFamily: "var(--font-body)",
    fontSize: 10,
    fontWeight: 700,
    color: "#C7561E",
    letterSpacing: "1.5px",
  },
  brandDivider: {
    width: 1,
    height: 36,
    background: "var(--line)",
  },
  brandTitle: {
    fontFamily: "var(--font-display)",
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  brandSub: {
    fontSize: 12,
    color: "var(--paper-dim)",
  },
  headerActions: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  paramToggleBtn: {
    background: "rgba(255, 255, 255, 0.05)",
    color: "var(--paper)",
    border: "1px solid var(--line)",
    borderRadius: 6,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 8,
    position: "relative",
    transition: "all 0.2s",
  },
  paramToggleBtnActive: {
    borderColor: "var(--brand-orange)",
    background: "rgba(199, 86, 30, 0.15)",
    color: "#fff",
  },
  filterBadgeCount: {
    background: "var(--brand-orange)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    width: 16,
    height: 16,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  refreshBtn: {
    background: "rgba(255, 255, 255, 0.05)",
    color: "var(--paper)",
    border: "1px solid var(--line)",
    borderRadius: 6,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  drawerOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.6)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "flex-end",
    backdropFilter: "blur(2px)",
  },
  drawerPanel: {
    width: "100%",
    maxWidth: 380,
    background: "var(--panel)",
    borderLeft: "1px solid var(--line)",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-5px 0 25px rgba(0,0,0,0.5)",
  },
  drawerHeader: {
    padding: "20px",
    borderBottom: "1px solid var(--line)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  drawerTitleContainer: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: 600,
    fontFamily: "var(--font-display)",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  drawerCloseBtn: {
    background: "transparent",
    border: "none",
    color: "var(--paper-dim)",
    padding: 4,
    borderRadius: 4,
  },
  drawerBody: {
    padding: 20,
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  paramGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  paramLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--paper)",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  drawerFooterActions: {
    marginTop: "auto",
    display: "flex",
    gap: 10,
    paddingTop: 20,
    borderTop: "1px solid var(--line)",
  },
  drawerClearBtn: {
    flex: 1,
    background: "transparent",
    color: "var(--paper-dim)",
    border: "1px solid var(--line)",
    borderRadius: 6,
    padding: "10px",
    fontSize: 13,
    fontWeight: 500,
  },
  drawerApplyBtn: {
    flex: 1,
    background: "var(--brand-orange)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "10px",
    fontSize: 13,
    fontWeight: 600,
  },
  errorBanner: {
    background: "rgba(199, 86, 30, 0.2)",
    color: "#E57373",
    borderBottom: "1px solid var(--brand-orange)",
    padding: "10px 20px",
    fontSize: 13,
  },
  content: {
    padding: 40,
    maxWidth: 1400,
    margin: "0 auto",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
    gap: 24,
  },
  kpiCard: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
  },
  kpiCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  kpiLabel: {
    fontSize: 13,
    color: "var(--paper-dim)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
    color: "var(--paper)",
    wordBreak: "break-all",
  },
};