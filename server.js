// server.js (ESM) - cole e rode no Render
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(cors()); // em produção restrinja o origin
app.use(express.json());

// variáveis (defina no Render)
const PIXEL_ID = process.env.PIXEL_ID;                      // primary
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;              // primary token
const API_VERSION = process.env.API_VERSION || "v19.0";
const TEST_EVENT_CODE = process.env.TEST_EVENT_CODE || null; // opcional

function sha256(value = "") {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function sendToPixel(pixelId, token, payload) {
  if (!pixelId || !token) return { skipped: true, reason: "missing_pixel_or_token" };
  
  const url = `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${token}`;
  
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const json = await resp.json();
    
    // LOG MELHORADO
    if (json.events_received) {
      console.log(`✅ Evento enviado com sucesso: ${json.events_received} eventos processados`);
    } else {
      console.log(`⚠️ Resposta do Facebook:`, json);
    }
    
    return json;
  } catch (error) {
    console.error(`❌ Erro ao enviar para pixel ${pixelId}:`, error);
    return { error: error.message };
  }
}

app.post("/event", async (req, res) => {
  try {
    const { 
      event_name = "CustomEvent", 
      event_id, 
      event_source_url = "", 
      user = {}, 
      custom_data = {},
      // NOVOS PARÂMETROS PARA ECOMMERCE
      action_source = "website"
    } = req.body;


    // SKIP PageView do servidor (evita duplicação)
    if (event_name && event_name.toLowerCase() === "pageview") {
      return res.json({ 
        ok: true, 
        skipped: "server_pageview_skipped",
        message: "PageView deve ser enviado apenas do cliente"
      });
    }


    // VALIDAÇÃO BÁSICA
    if (!event_name) {
      return res.status(400).json({ 
        error: "event_name é obrigatório" 
      });
    }


    // MONTAR USER_DATA COM HASH
    const user_data = {};
    
    if (user.email) {
      user_data.em = sha256(String(user.email).trim().toLowerCase());
    }
    if (user.phone) {
      // Limpar telefone (remover caracteres não numéricos)
      const cleanPhone = String(user.phone).replace(/\D/g, "");
      user_data.ph = sha256(cleanPhone);
    }
    if (user.name) {
      user_data.fn = sha256(String(user.name).trim().toLowerCase());
    }
    if (user.fbp) {
      user_data.fbp = user.fbp;
    }
    if (user.fbc) {
      user_data.fbc = user.fbc;
    }


    // CAPTURAR IP E USER AGENT
    user_data.client_user_agent = req.headers["user-agent"] || "";
    user_data.client_ip_address = req.headers["x-forwarded-for"]
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : req.socket.remoteAddress;


    // ENHANCED CUSTOM_DATA
    const enhanced_custom_data = { ...custom_data };
    
    // Garantir que value seja numérico se existir
    if (enhanced_custom_data.value) {
      enhanced_custom_data.value = parseFloat(enhanced_custom_data.value);
    }
    
    // Garantir currency padrão
    if (!enhanced_custom_data.currency && enhanced_custom_data.value) {
      enhanced_custom_data.currency = "BRL";
    }


    // MONTAR PAYLOAD
    const payload = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: event_id || `srv_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
          event_source_url,
          action_source,
          user_data,
          custom_data: enhanced_custom_data
        }
      ]
    };


    // ADICIONAR TEST CODE SE CONFIGURADO
    if (TEST_EVENT_CODE) {
      payload.test_event_code = TEST_EVENT_CODE;
    }


    // LOG DO EVENTO
    console.log(`📡 Enviando evento: ${event_name}`);
    console.log(`💰 Valor: ${enhanced_custom_data.value || 'N/A'}`);
    console.log(`🎯 Produto: ${enhanced_custom_data.content_name || 'N/A'}`);


    // ENVIAR PARA FACEBOOK
    const result = await sendToPixel(PIXEL_ID, ACCESS_TOKEN, payload);


    // RESPOSTA
    return res.json({ 
      ok: true, 
      event_name,
      pixel_id: PIXEL_ID,
      event_id: payload.data[0].event_id,
      value: enhanced_custom_data.value || null,
      result 
    });


  } catch (err) {
    console.error("❌ Erro CAPI:", err);
    return res.status(500).json({ 
      error: "Erro ao enviar evento para CAPI", 
      details: String(err) 
    });
  }
});


// ENDPOINT ESPECÍFICO PARA PURCHASE (ALTA PERFORMANCE)
app.post("/purchase", async (req, res) => {
  try {
    const { 
      event_id,
      user = {},
      product_value,
      product_name,
      product_id,
      transaction_id = null,
      event_source_url = ""
    } = req.body;



    // VALIDAÇÃO OBRIGATÓRIA
    if (!product_value || !product_name || !product_id) {
      return res.status(400).json({ 
        error: "Dados obrigatórios: product_value, product_name, product_id" 
      });
    }



    // VALIDAR SE VALUE É NUMÉRICO
    const numericValue = parseFloat(product_value);
    if (isNaN(numericValue) || numericValue <= 0) {
      return res.status(400).json({ 
        error: "product_value deve ser um número positivo" 
      });
    }



    // USER DATA COM HASH
    const user_data = {};
    
    if (user.email) {
      user_data.em = sha256(String(user.email).trim().toLowerCase());
    }
    if (user.phone) {
      const cleanPhone = String(user.phone).replace(/\D/g, "");
      user_data.ph = sha256(cleanPhone);
    }
    if (user.name) {
      user_data.fn = sha256(String(user.name).trim().toLowerCase());
    }
    if (user.fbp) user_data.fbp = user.fbp;
    if (user.fbc) user_data.fbc = user.fbc;



    // IP E USER AGENT
    user_data.client_user_agent = req.headers["user-agent"] || "";
    user_data.client_ip_address = req.headers["x-forwarded-for"]
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : req.socket.remoteAddress;



    // CUSTOM DATA OTIMIZADO PARA PURCHASE
    const custom_data = {
      content_ids: [product_id],
      content_name: product_name,
      content_type: "subscription",
      value: numericValue,
      currency: "BRL",
      num_items: 1
    };



    // ADICIONAR ORDER_ID SE TIVER
    if (transaction_id) {
      custom_data.order_id = transaction_id;
    }



    // PAYLOAD FINAL
    const payload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: event_id || `purchase_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
          event_source_url,
          action_source: "website",
          user_data,
          custom_data
        }
      ]
    };



    if (TEST_EVENT_CODE) {
      payload.test_event_code = TEST_EVENT_CODE;
    }



    // LOG DETALHADO
    console.log(`🛒 PURCHASE DETECTADO:`);
    console.log(`   📦 Produto: ${product_name}`);
    console.log(`   💰 Valor: R$ ${numericValue.toFixed(2)}`);
    console.log(`   🆔 ID: ${product_id}`);
    console.log(`   👤 Cliente: ${user.name || 'N/A'}`);
    console.log(`   💳 Transação: ${transaction_id || 'N/A'}`);



    // ENVIAR PARA FACEBOOK
    const result = await sendToPixel(PIXEL_ID, ACCESS_TOKEN, payload);



    // RESPOSTA OTIMIZADA
    return res.json({ 
      ok: true, 
      event: "Purchase", 
      product_name,
      value: numericValue,
      currency: "BRL",
      pixel_id: PIXEL_ID,
      event_id: payload.data[0].event_id,
      timestamp: new Date().toISOString(),
      result 
    });



  } catch (err) {
    console.error("❌ Erro Purchase CAPI:", err);
    return res.status(500).json({ 
      error: "Erro ao processar Purchase", 
      details: String(err) 
    });
  }
});

app.get("/", (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>StreamForce CAPI Server</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .ok { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
      </style>
    </head>
    <body>
      <h1>🚀 StreamForce CAPI Server</h1>
      <div class="status ok">✅ Servidor Online</div>
      <div class="status info">📊 Pixel ID: ${PIXEL_ID || 'NÃO CONFIGURADO'}</div>
      <div class="status info">🔑 Access Token: ${ACCESS_TOKEN ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}</div>
      <div class="status info">📋 API Version: ${API_VERSION}</div>
      <div class="status info">🧪 Test Code: ${TEST_EVENT_CODE ? 'ATIVO' : 'DESATIVADO'}</div>
      
      <h2>📡 Endpoints Disponíveis:</h2>
      <ul>
        <li><strong>POST /event</strong> - Enviar eventos gerais</li>
        <li><strong>POST /purchase</strong> - Enviar eventos de Purchase otimizados</li>
        <li><strong>GET /health</strong> - Status do servidor</li>
      </ul>
      
      <p><small>Última atualização: ${new Date().toISOString()}</small></p>
    </body>
    </html>
  `;
  res.send(html);
});

// HEALTH CHECK PARA MONITORAMENTO
app.get("/health", (req, res) => {
  const status = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    server: "StreamForce CAPI",
    version: "2.0",
    config: {
      pixel_id: PIXEL_ID ? "configured" : "missing",
      access_token: ACCESS_TOKEN ? "configured" : "missing",
      api_version: API_VERSION,
      test_mode: TEST_EVENT_CODE ? true : false
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  res.json(status);
});

const PORT = process.env.PORT || 3000;



app.listen(PORT, () => {
  console.log(`🚀 StreamForce CAPI Server iniciado!`);
  console.log(`📡 Porta: ${PORT}`);
  console.log(`🎯 Pixel ID: ${PIXEL_ID || 'NÃO CONFIGURADO'}`);
  console.log(`🔑 Token: ${ACCESS_TOKEN ? 'CONFIGURADO' : '❌ FALTANDO'}`);
  console.log(`📋 API Version: ${API_VERSION}`);
  console.log(`🧪 Test Mode: ${TEST_EVENT_CODE ? 'ATIVO' : 'DESATIVADO'}`);
  console.log(`⚡ Endpoints: /event, /purchase, /health`);
  console.log(`🌐 Acesse: https://seu-app.onrender.com`);
});