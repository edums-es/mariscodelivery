import{useState,useEffect}from"react";
import{Link}from"react-router-dom";
import axios from"axios";
import{toast}from"sonner";
import{maskPhone,maskCNPJ}from"@/lib/masks";
import{Fish,Truck,Layers,Handshake,ShoppingCart,Package,Star,Users,MapPin,Award,Menu,X,Sparkles,CheckCircle2}from"lucide-react";

const BACKEND=process.env.REACT_APP_BACKEND_URL;
const SLUG=process.env.REACT_APP_RESTAURANT_SLUG||"marisco-27";
const G="#D4AF37",G2="#B8860B",BK="#0B0B0F";

const NAV=[{l:"Início",id:"inicio"},{l:"Produtos",id:"produtos"},{l:"Atacado",id:"atacado"},{l:"Contato",id:"contato"}];
const BENEFITS=[
  {ic:Fish,     t:"Frescor garantido",               d:"Selecionamos os melhores mariscos diariamente para garantir sabor e qualidade."},
  {ic:Truck,    t:"Entrega rápida",                   d:"Logística eficiente e entrega refrigerada para manter a qualidade do mar até você."},
  {ic:Layers,   t:"Variedade premium",                d:"Ampla variedade de mariscos selecionados para atender todos os tipos de negócios."},
  {ic:Handshake,t:"Atendimento para varejo e atacado",d:"Soluções personalizadas e condições especiais para impulsionar seu negócio."},
];
const CATS=[
  {img:"/categ1%20(1).png",ic:Fish,     n:"Camarões",    d:"Diversos tamanhos e espécies"},
  {img:"/categ1%20(2).png",ic:Star,     n:"Lagostas",    d:"Seleção especial de qualidade"},
  {img:"/categ1%20(3).png",ic:Sparkles, n:"Caranguejos", d:"Frescor e sabor excepcionais"},
  {img:"/categ1%20(4).png",ic:Layers,   n:"Ostras",      d:"Doces, frescas e selecionadas"},
  {img:"/categ1%20(5).png",ic:Package,  n:"Mariscos",    d:"Variedade completa para seu negócio"},
];
const STATS=[
  {v:"15+",   l:"Anos de experiência",s:"no mercado",                      ic:Star},
  {v:"1.200+",l:"Clientes atendidos", s:"com excelência",                  ic:Users},
  {v:"100%",  l:"Da região atendida", s:"com agilidade",                   ic:MapPin},
  {v:null,    l:"Qualidade Premium",  s:"Processos rigorosos e seleção criteriosa",ic:Award},
];
const EF={company_name:"",contact_name:"",phone:"",email:"",cnpj:"",address:"",notes:""};
const go=id=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"});
const nb={background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0};
const INP={background:"#0D0D11",border:"1px solid rgba(212,175,55,0.2)",color:"#E5E5E5",borderRadius:8,padding:"11px 14px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"Manrope,sans-serif",transition:"border-color .2s"};

export default function Landing(){
  const[mo,setMo]=useState(false);
  const[rest,setRest]=useState(null);
  const[form,setForm]=useState(EF);
  const[sub,setSub]=useState(false);
  const[done,setDone]=useState(false);
  const[sc,setSc]=useState(false);

  useEffect(()=>{
    axios.get(`${BACKEND}/api/public/restaurants/${SLUG}`).then(r=>setRest(r.data.restaurant)).catch(()=>{});
    const fn=()=>setSc(window.scrollY>10);
    window.addEventListener("scroll",fn);
    return()=>window.removeEventListener("scroll",fn);
  },[]);

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const onSubmit=async e=>{
    e.preventDefault();
    if(!form.company_name.trim()||!form.phone.trim()){toast.error("Preencha empresa e telefone");return;}
    if(!rest?.id){toast.error("Erro de configuração");return;}
    setSub(true);
    try{await axios.post(`${BACKEND}/api/public/wholesale/register/${rest.id}`,form);setDone(true);setForm(EF);}
    catch(err){toast.error(err?.response?.data?.detail||"Erro ao enviar");}
    finally{setSub(false);}
  };

  return(
<div style={{background:BK,color:"#E5E5E5",fontFamily:"Manrope,sans-serif"}}>

{/* ══ HEADER ══════════════════════════════════════════ */}
<header className="hdr" style={{
  position:"fixed",top:0,left:0,right:0,zIndex:100,
  background:sc?"rgba(11,11,15,.97)":"rgba(11,11,15,.75)",
  backdropFilter:"blur(14px)",
  borderBottom:`1px solid ${sc?G+"28":"rgba(255,255,255,.07)"}`,
  transition:"all .3s",
}}>
  <div className="hdr-inner" style={{maxWidth:1280,margin:"0 auto",padding:"0 80px",height:88,display:"flex",alignItems:"center",justifyContent:"space-between"}}>

    {/* Logo — desktop 160×64, mobile 96×40 */}
    <img src="/logomarisco.png" alt="Marisco 27" className="logo-img"
      style={{width:160,height:64,objectFit:"contain",flexShrink:0}}/>

    {/* Nav desktop */}
    <nav className="nav-d" style={{display:"flex",alignItems:"center",gap:40}}>
      {NAV.map((l,i)=>(
        <button key={l.id} onClick={()=>go(l.id)}
          style={{...nb,color:i===0?G:"#BFB090",fontSize:15,fontWeight:500,
            paddingBottom:4,borderBottom:i===0?`2px solid ${G}`:"2px solid transparent"}}
          onMouseEnter={e=>e.currentTarget.style.color=G}
          onMouseLeave={e=>e.currentTarget.style.color=i===0?G:"#BFB090"}>
          {l.l}
        </button>
      ))}
    </nav>

    {/* Buttons desktop: 160×44 + 16px + 180×44 */}
    <div className="nav-d" style={{display:"flex",alignItems:"center",gap:16}}>
      <Link to={`/loja/${SLUG}`}>
        <button style={{width:160,height:44,borderRadius:8,border:`1.5px solid ${G}`,
          background:"transparent",color:G,fontSize:14,fontWeight:600,fontFamily:"inherit",
          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
          onMouseEnter={e=>e.currentTarget.style.background=`${G}15`}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <ShoppingCart size={15}/>Fazer Pedido
        </button>
      </Link>
      <button onClick={()=>go("atacado")}
        style={{width:180,height:44,borderRadius:8,border:"none",background:G,
          color:BK,fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
        onMouseEnter={e=>e.currentTarget.style.background=G2}
        onMouseLeave={e=>e.currentTarget.style.background=G}>
        <Package size={15}/>Comprar Atacado
      </button>
    </div>

    {/* Hamburger mobile */}
    <button className="nav-m" onClick={()=>setMo(o=>!o)}
      style={{...nb,color:G,display:"none",padding:8}}>
      {mo?<X size={24}/>:<Menu size={24}/>}
    </button>
  </div>

  {/* Mobile dropdown */}
  {mo&&(
    <div style={{background:"rgba(11,11,15,.98)",borderTop:`1px solid ${G}20`,padding:"16px 20px 24px",position:"absolute",top:"100%",left:0,right:0,zIndex:200}}>
      {NAV.map(l=>(
        <button key={l.id} onClick={()=>{go(l.id);setMo(false);}}
          style={{...nb,display:"block",width:"100%",textAlign:"left",
            color:"#BFB090",fontSize:15,fontWeight:500,
            padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
          {l.l}
        </button>
      ))}
      <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:12}}>
        <Link to={`/loja/${SLUG}`} onClick={()=>setMo(false)}>
          <button style={{width:"100%",height:48,borderRadius:8,border:`1.5px solid ${G}`,
            background:"transparent",color:G,fontSize:14,fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            Fazer Pedido
          </button>
        </Link>
        <button onClick={()=>{go("atacado");setMo(false);}}
          style={{width:"100%",height:48,borderRadius:8,border:"none",
            background:G,color:BK,fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          Comprar Atacado
        </button>
      </div>
    </div>
  )}
</header>

{/* ══ HERO ════════════════════════════════════════════ */}
<section id="inicio" className="hero-sec" style={{
  position:"relative",
  overflow:"hidden",
  height:"100vh",
  display:"flex",
  alignItems:"center",
}}>
  {/* Background image — seafood plate anchored to the right */}
  <div className="hero-bg" style={{
    position:"absolute",inset:0,
    backgroundImage:"url('/bg-hero.png')",
    backgroundSize:"cover",
    backgroundPosition:"right center",
    backgroundRepeat:"no-repeat",
  }}/>

  {/* Gradient overlay */}
  <div className="hero-overlay" style={{
    position:"absolute",inset:0,
    background:"linear-gradient(90deg, rgba(11,11,15,1) 0%, rgba(11,11,15,.96) 38%, rgba(11,11,15,.80) 58%, rgba(11,11,15,.15) 80%, transparent 100%)",
  }}/>

  {/* Content — left-aligned on top of the bg */}
  <div className="hero-inner" style={{
    position:"relative",zIndex:2,
    maxWidth:1440,margin:"0 auto",
    padding:"0 120px",
    paddingTop:148,
    paddingBottom:80,
    width:"100%",boxSizing:"border-box",
    height:"100%",display:"flex",alignItems:"center",
  }}>
    <div className="hero-left" style={{maxWidth:560}}>

      {/* Badge */}
      <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:20}}>
        <span style={{color:G,fontSize:13}}>◆</span>
        <span style={{color:G,fontSize:11,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase"}}>
          Qualidade que você confia
        </span>
      </div>

      {/* H1 */}
      <h1 className="hero-h1" style={{margin:"0 0 20px",lineHeight:1.05,
        fontFamily:"Outfit,sans-serif",fontWeight:800,fontSize:64}}>
        <span style={{display:"block",color:"#FFF"}}>Mariscos premium</span>
        <span style={{display:"block",
          background:`linear-gradient(90deg,${G} 0%,#F5CC55 50%,${G2} 100%)`,
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
          para seu negócio
        </span>
      </h1>

      {/* Description */}
      <p className="hero-desc" style={{margin:"0 0 20px",fontSize:16,lineHeight:1.7,color:"#9A9A8A",maxWidth:480}}>
        Frescor que se sente, qualidade que você confia e variedade que valoriza seu cardápio.
        Entrega confiável, parceria duradoura e atendimento que faz a diferença.
      </p>

      {/* Crown badge */}
      <div style={{display:"inline-flex",alignItems:"center",gap:8,height:32,
        marginBottom:28,background:`${G}12`,border:`1px solid ${G}40`,
        borderRadius:100,padding:"0 18px"}}>
        <span style={{color:G,fontSize:14}}>♛</span>
        <span style={{color:G,fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>
          Maior fornecedor de mariscos da região
        </span>
      </div>

      {/* Buttons */}
      <div className="hero-btns" style={{display:"flex",flexDirection:"row",gap:16,marginBottom:28}}>
        <Link to={`/loja/${SLUG}`} className="hero-btn-wrap">
          <button className="hero-btn" style={{width:190,height:54,borderRadius:8,border:"none",
            background:`linear-gradient(135deg,${G},${G2})`,
            color:BK,fontSize:15,fontWeight:700,fontFamily:"inherit",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:10,
            boxShadow:`0 4px 24px ${G}50`,transition:"all .2s"}}
            onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
            onMouseLeave={e=>e.currentTarget.style.transform="none"}>
            <ShoppingCart size={18}/>Fazer Pedido
          </button>
        </Link>
        <button className="hero-btn hero-btn-out" onClick={()=>go("atacado")}
          style={{width:190,height:54,borderRadius:8,
            border:`2px solid ${G}55`,background:`${G}08`,
            color:"#E5E5E5",fontSize:15,fontWeight:700,fontFamily:"inherit",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"all .2s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=G;e.currentTarget.style.background=`${G}18`;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=`${G}55`;e.currentTarget.style.background=`${G}08`;}}>
          <Package size={18}/>Comprar Atacado
        </button>
      </div>

      {/* Social proof */}
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{display:"flex"}}>
          {[["#6B3A1F","E"],["#1E5C35","M"],["#1A3260","R"],["#4A2060","A"]].map(([bg,l],i)=>(
            <div key={i} style={{width:34,height:34,borderRadius:"50%",
              border:`2px solid ${BK}`,background:bg,
              display:"flex",alignItems:"center",justifyContent:"center",
              color:"#fff",fontSize:11,fontWeight:700,marginLeft:i?-9:0}}>
              {l}
            </div>
          ))}
        </div>
        <div>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:"#E5E5E5",lineHeight:1.2}}>+1.200 clientes satisfeitos</p>
          <p style={{margin:0,fontSize:11,color:"#666"}}>confiam na Marisco 27</p>
        </div>
      </div>
    </div>
  </div>
</section>

{/* ══ GAP ═════════════════════════════════════════════ */}
<div style={{height:24,background:BK}}/>

{/* ══ BENEFITS ════════════════════════════════════════ */}
<section style={{background:"#111116",borderTop:`1px solid ${G}14`,borderBottom:`1px solid ${G}14`}}>
  <div className="ct" style={{maxWidth:1280,margin:"0 auto",padding:"0 80px",boxSizing:"border-box"}}>
    {/* Desktop: 4-col grid | Mobile: 1-col stack */}
    <div className="ben-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,padding:"0"}}>
      {BENEFITS.map(f=>(
        <div key={f.t} style={{height:110,display:"flex",alignItems:"flex-start",
          gap:16,padding:20,background:"#0F0F14",borderRadius:8,
          border:`1px solid ${G}10`,boxSizing:"border-box"}}>
          <div style={{width:52,height:52,borderRadius:"50%",flexShrink:0,
            background:`${G}13`,border:`1.5px solid ${G}30`,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <f.ic size={22} style={{color:G}}/>
          </div>
          <div>
            <p style={{margin:"0 0 5px",fontSize:13,fontWeight:700,color:"#E0E0D8",lineHeight:1.3}}>{f.t}</p>
            <p style={{margin:0,fontSize:11,color:"#5A5A50",lineHeight:1.5}}>{f.d}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>

{/* ══ GAP ═════════════════════════════════════════════ */}
<div style={{height:24,background:BK}}/>

{/* ══ CATEGORIES ══════════════════════════════════════ */}
<section id="produtos" style={{background:"#F5EDD8",padding:"28px 0 32px"}}>
  <div className="ct" style={{maxWidth:1280,margin:"0 auto",padding:"0 80px",boxSizing:"border-box"}}>
    {/* Section header */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:10}}>
      <div style={{height:1,width:70,background:`linear-gradient(to right,transparent,${G2})`}}/>
      <span style={{color:G2,fontSize:10,fontWeight:700,letterSpacing:"0.28em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Nossos Produtos</span>
      <div style={{height:1,width:70,background:`linear-gradient(to left,transparent,${G2})`}}/>
    </div>
    <h2 className="cat-h2" style={{textAlign:"center",margin:"0 0 6px",color:"#1A1A1A",
      fontFamily:"Outfit,sans-serif",fontWeight:800,fontSize:38,lineHeight:"48px"}}>
      Qualidade que vem do mar para sua mesa
    </h2>
    <p style={{textAlign:"center",color:"#888",fontSize:14,margin:"0 0 20px"}}>
      Conheça nossa seleção de mariscos premium
    </p>

    {/* Desktop: 5-col 232px | Mobile: 1-col 100% */}
    <div className="cat-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,232px)",gap:12,justifyContent:"center"}}>
      {CATS.map(c=>(
        <div key={c.n} className="cat-card" style={{width:232,borderRadius:8,overflow:"hidden",
          background:"#1A1A1F",boxShadow:"0 4px 16px rgba(0,0,0,.35)",
          transition:"transform .25s,box-shadow .25s",cursor:"pointer"}}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 10px 28px rgba(0,0,0,.5),0 0 0 1px ${G}40`;}}
          onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.35)";}}>
          <div style={{display:"flex",alignItems:"center",padding:16,gap:12,height:104,boxSizing:"border-box"}}>
            {/* Image 96×96 */}
            <div style={{width:96,height:96,flexShrink:0,borderRadius:6,overflow:"hidden"}}>
              <img src={c.img} alt={c.n}
                style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
            </div>
            {/* Text */}
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
              <div style={{width:28,height:28,borderRadius:"50%",
                background:`${G}18`,border:`1px solid ${G}45`,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <c.ic size={13} style={{color:G}}/>
              </div>
              <p style={{margin:0,fontSize:13,fontWeight:700,color:"#F0F0EC",fontFamily:"Outfit,sans-serif",lineHeight:1.2}}>{c.n}</p>
              <p style={{margin:0,fontSize:11,color:"#888",lineHeight:1.3}}>{c.d}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>

{/* ══ GAP ═════════════════════════════════════════════ */}
<div style={{height:24,background:BK}}/>

{/* ══ STATS ═══════════════════════════════════════════ */}
<section style={{background:"#111116",borderTop:`1px solid ${G}14`,borderBottom:`1px solid ${G}14`}}>
  <div className="ct" style={{maxWidth:1280,margin:"0 auto",padding:"0 80px",boxSizing:"border-box"}}>
    {/* Desktop: flex row 110px | Mobile: flex col 448px */}
    <div className="stat-grid" style={{display:"flex",alignItems:"center",height:110}}>
      {STATS.map((s,i)=>(
        <div key={s.l} className="stat-item" style={{flex:1,display:"flex",alignItems:"center",gap:16,
          padding:"0 24px",borderRight:i<3?`1px solid ${G}16`:"none"}}>
          <div style={{width:48,height:48,flexShrink:0,borderRadius:"50%",
            background:`${G}12`,border:`1.5px solid ${G}28`,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <s.ic size={20} style={{color:G}}/>
          </div>
          <div>
            {s.v&&<p style={{margin:"0 0 1px",fontFamily:"Outfit,sans-serif",fontWeight:800,
              fontSize:32,color:G,lineHeight:1}}>{s.v}</p>}
            <p style={{margin:"0 0 1px",fontWeight:700,fontSize:13,color:"#E5E5E5",lineHeight:1.2}}>{s.l}</p>
            <p style={{margin:0,fontSize:11,color:"#555"}}>{s.s}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>

{/* ══ ATACADO ═════════════════════════════════════════ */}
<section id="atacado" style={{background:BK,padding:"80px 0"}}>
  <div className="ct atk-grid" style={{maxWidth:1280,margin:"0 auto",padding:"0 80px",
    display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"start",boxSizing:"border-box"}}>
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <Sparkles size={13} style={{color:G}}/>
        <span style={{color:G,fontSize:10,fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase"}}>Comprar Atacado</span>
      </div>
      <h2 style={{margin:"0 0 16px",fontFamily:"Outfit,sans-serif",fontWeight:800,
        fontSize:36,color:"#E5E5E5",lineHeight:1.15}}>
        Parceria que move<br/>
        <span style={{background:`linear-gradient(90deg,${G},${G2})`,
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
          seu negócio
        </span>
      </h2>
      <p style={{color:"#666",fontSize:15,lineHeight:1.75,marginBottom:24}}>
        Condições especiais para restaurantes, peixarias, hotéis e revendedores.
        Preencha o cadastro e nossa equipe entra em contato com proposta personalizada.
      </p>
      <ul style={{listStyle:"none",margin:0,padding:0,display:"flex",flexDirection:"column",gap:10}}>
        {["Preços exclusivos para atacado","Entrega programada e confiável","Produtos frescos diretamente da fonte","Atendimento dedicado para seu negócio","Condições de pagamento flexíveis"].map(it=>(
          <li key={it} style={{display:"flex",alignItems:"center",gap:10,fontSize:14,color:"#888"}}>
            <CheckCircle2 size={14} style={{color:G,flexShrink:0}}/>{it}
          </li>
        ))}
      </ul>
    </div>
    <div style={{background:"#1A1A1F",border:`1px solid ${G}20`,borderRadius:16,padding:32}}>
      {done?(
        <div style={{textAlign:"center",padding:"24px 0"}}>
          <CheckCircle2 size={52} style={{color:G,marginBottom:12}}/>
          <h3 style={{margin:"0 0 8px",fontFamily:"Outfit,sans-serif",fontWeight:700,fontSize:"1.15rem",color:"#E5E5E5"}}>Cadastro enviado!</h3>
          <p style={{color:"#666",fontSize:13}}>Nossa equipe entrará em contato em breve.</p>
          <button onClick={()=>setDone(false)} style={{...nb,marginTop:16,color:G,fontSize:13,textDecoration:"underline"}}>Enviar outro</button>
        </div>
      ):(
        <>
          <h3 style={{margin:"0 0 20px",fontFamily:"Outfit,sans-serif",fontWeight:700,fontSize:"0.95rem",color:"#E5E5E5"}}>Cadastro de Comprador Atacadista</h3>
          <form onSubmit={onSubmit} style={{display:"flex",flexDirection:"column",gap:12}}>
            <Fld l="Empresa *"><input type="text" value={form.company_name} onChange={e=>set("company_name",e.target.value)} placeholder="Nome da empresa" required style={INP} onFocus={e=>e.target.style.borderColor=G} onBlur={e=>e.target.style.borderColor="rgba(212,175,55,0.2)"}/></Fld>
            <Row2><Fld l="Contato"><input type="text" value={form.contact_name} onChange={e=>set("contact_name",e.target.value)} placeholder="Responsável" style={INP} onFocus={e=>e.target.style.borderColor=G} onBlur={e=>e.target.style.borderColor="rgba(212,175,55,0.2)"}/>  </Fld><Fld l="Telefone *"><input type="tel" value={form.phone} onChange={e=>set("phone",maskPhone(e.target.value))} placeholder="(XX) XXXXX-XXXX" maxLength={15} required style={INP} onFocus={e=>e.target.style.borderColor=G} onBlur={e=>e.target.style.borderColor="rgba(212,175,55,0.2)"}/>  </Fld></Row2>
            <Row2><Fld l="E-mail"><input type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="email@empresa.com" style={INP} onFocus={e=>e.target.style.borderColor=G} onBlur={e=>e.target.style.borderColor="rgba(212,175,55,0.2)"}/>  </Fld><Fld l="CNPJ"><input type="text" value={form.cnpj} onChange={e=>set("cnpj",maskCNPJ(e.target.value))} placeholder="00.000.000/0001-00" maxLength={18} style={INP} onFocus={e=>e.target.style.borderColor=G} onBlur={e=>e.target.style.borderColor="rgba(212,175,55,0.2)"}/>  </Fld></Row2>
            <Fld l="Endereço"><input type="text" value={form.address} onChange={e=>set("address",e.target.value)} placeholder="Rua, nº, bairro, cidade" style={INP} onFocus={e=>e.target.style.borderColor=G} onBlur={e=>e.target.style.borderColor="rgba(212,175,55,0.2)"}/>  </Fld>
            <Fld l="Observações"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Volume de compra, produtos de interesse..." rows={3} style={{...INP,resize:"none"}} onFocus={e=>e.target.style.borderColor=G} onBlur={e=>e.target.style.borderColor="rgba(212,175,55,0.2)"}/></Fld>
            <button type="submit" disabled={sub}
              style={{height:44,borderRadius:8,border:"none",
                background:`linear-gradient(135deg,${G},${G2})`,
                color:BK,fontSize:14,fontWeight:700,fontFamily:"inherit",
                cursor:sub?"not-allowed":"pointer",opacity:sub?.6:1,marginTop:4}}>
              {sub?"Enviando...":"Enviar Cadastro"}
            </button>
          </form>
        </>
      )}
    </div>
  </div>
</section>

{/* ══ FOOTER ══════════════════════════════════════════ */}
<footer id="contato" style={{background:"#111116",borderTop:`1px solid ${G}12`,padding:"48px 0 24px"}}>
  <div className="ct ft-grid" style={{maxWidth:1280,margin:"0 auto",padding:"0 80px",
    display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:40,marginBottom:36,boxSizing:"border-box"}}>
    <div>
      <img src="/logomarisco.png" alt="Marisco 27" className="logo-ft" style={{height:56,marginBottom:14}}/>
      <p style={{color:"#444",fontSize:13,lineHeight:1.7,maxWidth:280}}>
        Fornecimento premium de mariscos para restaurantes, peixarias e negócios que exigem o melhor do mar.
      </p>
    </div>
    <div>
      <p style={{color:G,fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>Navegação</p>
      {[...NAV,{l:"Ver Cardápio",id:null,href:`/loja/${SLUG}`}].map(l=>(
        <div key={l.l} style={{marginBottom:8}}>
          {l.href?<Link to={l.href} style={{color:"#555",fontSize:13,textDecoration:"none"}} onMouseEnter={e=>e.currentTarget.style.color=G} onMouseLeave={e=>e.currentTarget.style.color="#555"}>{l.l}</Link>
          :<button onClick={()=>go(l.id)} style={{...nb,color:"#555",fontSize:13}} onMouseEnter={e=>e.currentTarget.style.color=G} onMouseLeave={e=>e.currentTarget.style.color="#555"}>{l.l}</button>}
        </div>
      ))}
    </div>
    <div>
      <p style={{color:G,fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>Acesso</p>
      <Link to="/login">
        <button style={{padding:"10px 20px",borderRadius:8,border:`1.5px solid ${G}40`,
          background:"transparent",color:G,fontSize:13,fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.background=`${G}12`}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          Acessar Painel
        </button>
      </Link>
    </div>
  </div>
  <div className="ct" style={{maxWidth:1280,margin:"0 auto",padding:"0 80px",boxSizing:"border-box"}}>
    <div style={{borderTop:`1px solid ${G}10`,paddingTop:18,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
      <span style={{color:"#333",fontSize:12}}>© {new Date().getFullYear()} Marisco 27 — Todos os direitos reservados</span>
      <span style={{color:"#333",fontSize:12}}>Mariscos premium para seu negócio</span>
    </div>
  </div>
</footer>

{/* ══ RESPONSIVE CSS ══════════════════════════════════ */}
<style>{`
/* ── DESKTOP BASE ── */
.nav-d{display:flex!important}
.nav-m{display:none!important}
.hero-sec{height:100vh!important}
.hero-inner{
  padding:0 120px!important;
  padding-top:148px!important;
  padding-bottom:80px!important;
  max-width:1440px!important;
  height:100%!important;
  display:flex!important;
  align-items:center!important;
}
.hero-left{max-width:580px!important}
.hero-h1{font-size:64px!important}
.hero-btns{flex-direction:row!important;gap:16px!important}
.hero-btn{width:190px!important;height:54px!important}
.hero-btn-wrap{display:block}
.hdr-inner{height:88px!important;padding:0 80px!important}
.logo-img{width:160px!important;height:64px!important}
.ben-grid{grid-template-columns:repeat(4,1fr)!important;padding:0!important}
.cat-grid{grid-template-columns:repeat(5,232px)!important;justify-content:center!important}
.cat-card{width:232px!important}
.cat-h2{font-size:38px!important;line-height:48px!important}
.stat-grid{flex-direction:row!important;height:110px!important}
.stat-item{border-bottom:none!important;padding:0 24px!important}
.atk-grid{grid-template-columns:1fr 1fr!important;gap:80px!important}
.ft-grid{grid-template-columns:2fr 1fr 1fr!important;gap:40px!important}

/* ── MOBILE ≤ 768px ── */
@media(max-width:768px){
  /* header */
  .nav-d{display:none!important}
  .nav-m{display:flex!important}
  .hdr-inner{height:72px!important;padding:0 20px!important}
  .logo-img{width:96px!important;height:40px!important}

  /* hero — mobile: switch to portrait image */
  .hero-sec{min-height:100svh!important}
  .hero-inner{
    padding:100px 20px 40px!important;
    align-items:flex-start!important;
    height:auto!important;
  }
  .hero-left{max-width:100%!important}
  .hero-h1{font-size:38px!important}
  /* swap bg image for mobile portrait version */
  .hero-bg{
    background-image:url('/bg-mobile.png')!important;
    background-position:center bottom!important;
  }
  /* gradient: dark top (text area) → transparent bottom (food area) */
  .hero-overlay{
    background:linear-gradient(180deg,
      rgba(11,11,15,1) 0%,
      rgba(11,11,15,.92) 35%,
      rgba(11,11,15,.60) 60%,
      rgba(11,11,15,.10) 85%,
      transparent 100%
    )!important;
  }
  /* buttons stacked on mobile */
  .hero-btns{flex-direction:column!important;gap:12px!important;width:100%!important}
  .hero-btn{width:100%!important;height:50px!important}
  .hero-btn-wrap{display:block!important;width:100%!important}

  /* container padding */
  .ct{padding:0 20px!important}

  /* benefits — vertical stack, each 104px */
  .ben-grid{
    grid-template-columns:1fr!important;
    gap:12px!important;
    padding:20px 0!important;
  }

  /* categories */
  .cat-grid{
    grid-template-columns:1fr!important;
    justify-content:stretch!important;
    gap:12px!important;
  }
  .cat-card{width:100%!important}
  .cat-h2{font-size:28px!important;line-height:36px!important;text-align:center!important}

  /* stats — vertical, 448px total */
  .stat-grid{
    flex-direction:column!important;
    height:auto!important;
    padding:24px 0!important;
    gap:0!important;
  }
  .stat-item{
    padding:20px 0!important;
    border-right:none!important;
    border-bottom:1px solid rgba(212,175,55,0.14)!important;
    flex:none!important;
    width:100%!important;
  }
  .stat-item:last-child{border-bottom:none!important}

  /* atacado */
  .atk-grid{grid-template-columns:1fr!important;gap:40px!important;padding:0 20px!important}

  /* footer */
  .ft-grid{grid-template-columns:1fr!important;gap:28px!important;padding:0 20px!important;margin-bottom:28px!important}
  .logo-ft{height:44px!important}
}
`}</style>
</div>
);}

function Fld({l,children}){return(<div><label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#555",marginBottom:5}}>{l}</label>{children}</div>);}
function Row2({children}){return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{children}</div>);}
