// server.js (ESM) - FURION POWER CAPI
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import crypto from "crypto";



const app = express();

app.set('trust proxy', 1);

// FURION POWER - Enhanced CORS
app.use(cors({
  origin: [
    'https://acesstream.com.br',
    'https://www.acesstream.com.br'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));



app.use(express.json({
  limit: '10mb',
  strict: true
}));



// FURION POWER - Environment Variables
const PIXEL_ID = process.env.PIXEL_ID || '1100931802499405'; // seu pixel
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error("ACCESS_TOKEN não configurado.");
  process.exit(1);
} // obrigatório



const API_VERSION = process.env.API_VERSION || "v22.0";
const TEST_EVENT_CODE = process.env.TEST_EVENT_CODE || null;



// ✅ FURION POWER - SHA256 MELHORADO
function sha256(value = "") {
    if (!value || typeof value !== 'string') return '';
    try {
        // Normalização avançada
        const normalizedValue = String(value)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ') // Múltiplos espaços → espaço único
            .replace(/\s+$/, ''); // Remove espaços finais
            
        return crypto.createHash("sha256")
            .update(normalizedValue)
            .digest("hex");
    } catch (error) {
        console.error('SHA256 Error:', error);
        return '';
    }
}


// ✅ FURION POWER - FUNÇÕES DE ENRICHMENT AVANÇADO



// FURION POWER - Multi-pixel sender with retry logic
async function sendToPixel(payload, retryCount = 0) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { error: true, message: "Pixel ou token não configurado" };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
  "Content-Type": "application/json",
  "Connection": "keep-alive"
},
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(result)}`);
    }

    return {
      success: true,
      events_received: result.events_received || 0,
      fbtrace_id: result.fbtrace_id || null
    };

  } catch (error) {
    console.error("Erro no envio:", error.message);

    if (retryCount < 2) {
      await new Promise(r => setTimeout(r, 1000));
      return sendToPixel(payload, retryCount + 1);
    }

    return {
      error: true,
      message: error.message
    };
  }
}

function detectPhoneRegion(areaCode = '') {
  const regions = {
    '11': 'SP',
    '21': 'RJ',
    '27': 'ES',
    '31': 'MG',
    '41': 'PR',
    '47': 'SC',
    '51': 'RS',
    '61': 'DF',
    '62': 'GO',
    '71': 'BA',
    '77': 'BA',
    '85': 'CE'
  };

  return regions[areaCode] || 'unknown';
}

function analyzeUserAgent(ua = '') {
  ua = ua.toLowerCase();

  let browser = 'unknown';
  let os = 'unknown';
  let device_type = 'desktop';

  if (ua.includes('chrome')) browser = 'chrome';
  else if (ua.includes('firefox')) browser = 'firefox';
  else if (ua.includes('safari')) browser = 'safari';

  if (ua.includes('windows')) os = 'windows';

  if (ua.includes('android')) {
    os = 'android';
    device_type = 'mobile';
  }

  if (ua.includes('iphone')) {
    os = 'ios';
    device_type = 'mobile';
  }

  return {
    browser,
    os,
    device_type
  };
}

function enhanceEventPayload(payload, user_data, enrichment_data, custom_data, startTime) {
  payload.data[0].custom_data = {
    ...payload.data[0].custom_data,
    enrichment_data,
    processing_time_ms: Date.now() - startTime,
    match_quality: Object.keys(user_data).length
  };

  return payload;
}

// FURION POWER - Main event handler
app.post("/event", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      event_name = "CustomEvent", 
      event_id, 
      event_source_url = "", 
      user = {}, 
      custom_data = {} 
    } = req.body;



    // FURION POWER - Skip server-side PageView to avoid duplication
    if (event_name && event_name.toLowerCase() === "pageview") {
      return res.json({ 
        ok: true, 
        skipped: "server_pageview_avoided",
        message: "PageView events should be client-side only"
      });
    }



    // FURION POWER - Enhanced user data processing
    // ✅ FURION POWER - PROCESSAMENTO MELHORADO DE DADOS
    // ✅ FURION POWER - PROCESSAMENTO MELHORADO DE DADOS + ENRICHMENT
    // ✅ FURION POWER - PROCESSAMENTO CORRIGIDO (SEM ENRICHMENT NO USER_DATA)
    const user_data = {};
    const enrichment_data = {};
   

    // ✅ EMAIL - Normalização + hash (APENAS HASH NO USER_DATA)
    if (user.email) {
        const cleanEmail = String(user.email)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/\.+/g, '.')
            .replace(/\+.*@/, '@');
        
        user_data.em = sha256(cleanEmail);
        console.log('✅ Email processado:', cleanEmail.substring(0, 3) + '***');
        
        // ✅ ENRICHMENT SEPARADO
        const domain = cleanEmail.split('@')[1];
        const premiumDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];
        enrichment_data.email_quality = premiumDomains.includes(domain) ? 'premium' : 'standard';
    }

   

    // ✅ TELEFONE - Normalização + hash (APENAS HASH NO USER_DATA)
    // ✅ TELEFONE - VALIDAÇÃO MELHORADA E MAIS FLEXÍVEL
    if (user.phone) {
        let cleanPhone = String(user.phone)
            .replace(/\D/g, '') // Remove todos os caracteres não numéricos
            .replace(/^0+/, ''); // Remove zeros iniciais
        
        console.log('📱 Telefone original recebido:', user.phone);
        console.log('📱 Telefone limpo inicial:', cleanPhone);
        
        // ✅ NORMALIZAÇÃO BRASILEIRA MELHORADA
        if (cleanPhone.length === 10) {
            // Telefone fixo (11) 9999-9999 -> adiciona 9
            cleanPhone = cleanPhone.substring(0, 2) + '9' + cleanPhone.substring(2);
        }
        
        if (cleanPhone.length === 11 && !cleanPhone.startsWith('55')) {
            cleanPhone = '55' + cleanPhone;
        }
        
        // ✅ VALIDAÇÃO MAIS FLEXÍVEL
        if (cleanPhone.length >= 12 && cleanPhone.length <= 13){ // ✅ ACEITA MAIS FORMATOS
            // Garantir que tenha pelo menos código do país
            if (!cleanPhone.startsWith('55') && cleanPhone.length === 11) {
                cleanPhone = '55' + cleanPhone;
            }
            
            user_data.ph = sha256(cleanPhone);
            console.log('✅ Telefone processado FINAL:', cleanPhone.substring(0, 4) + '***');
            console.log('✅ Hash do telefone gerado:', user_data.ph ? 'SUCCESS' : 'FAILED');
            
            // ✅ ENRICHMENT SEPARADO
            const areaCode = cleanPhone.length >= 4 ? cleanPhone.substring(2, 4) : '11';
            enrichment_data.phone_region = detectPhoneRegion(areaCode);
            enrichment_data.phone_quality = cleanPhone.length === 13 ? 'mobile' : 'landline';
            enrichment_data.phone_length = cleanPhone.length;
        } else {
            console.warn('⚠️ Telefone muito curto, ignorado:', cleanPhone);
        }
    }

   

    // ✅ NOME - Normalização + hash (APENAS HASH NO USER_DATA)
    if (user.name) {
        const cleanName = String(user.name)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\p{L}\s]/gu, '');
        
        const nameParts = cleanName.split(' ').filter(part => part.length > 1);
        
        if (nameParts.length > 0) {
            user_data.fn = sha256(nameParts[0]);
            console.log('✅ Primeiro nome processado:', nameParts[0].substring(0, 2) + '***');
            
            if (nameParts.length > 1) {
                user_data.ln = sha256(nameParts.slice(1).join(' '));
                console.log('✅ Sobrenome processado');
            }
            
            // ✅ ENRICHMENT SEPARADO
            enrichment_data.name_quality = nameParts.length >= 2 ? 'complete' : 'partial';
            enrichment_data.name_length = nameParts.length;
        }
    }

   

    // ✅ EXTERNAL_ID - Hash (APENAS HASH NO USER_DATA)
    if (user.external_id) {
        const cleanExternalId = String(user.external_id)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');
        
        user_data.external_id = sha256(cleanExternalId);
        console.log('✅ External ID processado:', cleanExternalId.substring(0, 5) + '***');
        
        // ✅ ENRICHMENT SEPARADO
        enrichment_data.external_id_quality = cleanExternalId.length > 20 ? 'high' : 'standard';
    }

   

    // ✅ BROWSER FINGERPRINTING (PERMITIDOS NO USER_DATA)
    if (user.fbp) {
        user_data.fbp = String(user.fbp).trim();
        console.log('✅ FBP capturado:', user.fbp.substring(0, 10) + '***');
    }

   

    if (user.fbc) {
        user_data.fbc = String(user.fbc).trim();
        console.log('✅ FBC capturado:', user.fbc.substring(0, 10) + '***');
    }

   

    // ✅ CLIENT DATA (PERMITIDOS NO USER_DATA)
    user_data.client_user_agent = req.headers["user-agent"] || "";

   

    user_data.client_ip_address = 
        req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.headers["x-real-ip"] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        "unknown";

   

    console.log('✅ Client IP capturado:', user_data.client_ip_address);

   

    // ✅ DEVICE ANALYSIS SEPARADO
    if (user_data.client_user_agent) {
        const deviceInfo = analyzeUserAgent(user_data.client_user_agent);
        enrichment_data.device_type = deviceInfo.device_type;
        enrichment_data.browser_name = deviceInfo.browser;
        enrichment_data.os_name = deviceInfo.os;
        console.log('✅ Device info:', deviceInfo);
    }



    // FURION POWER - Event payload construction
    // ✅ FURION POWER - ENHANCED EVENT PAYLOAD CONSTRUCTION
    let eventPayload = {
        data: [{
            event_name,
            event_time: req.body.event_time || Math.floor(Date.now() / 1000),
            event_id: event_id || `srv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            event_source_url: event_source_url || 'https://acesstream.com.br',
            action_source: "website",
            user_data,
            custom_data: {
                ...custom_data,
                server_event: true
            }
        }]
    };

  

    // ✅ APPLY ADVANCED ENRICHMENT
    eventPayload = enhanceEventPayload(eventPayload, user_data, enrichment_data, custom_data, startTime);

  

    // Add test event code if provided
    if (TEST_EVENT_CODE) {
        eventPayload.test_event_code = TEST_EVENT_CODE;
    }



    // FURION POWER - Send to all pixels concurrently
    const result = await sendToPixel(eventPayload);

    const totalTime = Date.now() - startTime;

    
        console.log(`📡 CAPI: ${event_name} | ${result.success ? 'SUCCESS' : 'ERROR'} | ${totalTime}ms`);
        
        // ✅ FURION POWER - LOG DETALHADO
        if (result.success) {
            console.log(`✅ Event ID: ${eventPayload.data[0].event_id}`);
            console.log(`✅ Events Received: ${result.events_received || 0}`);
            console.log(`✅ FB Trace: ${result.fbtrace_id || 'N/A'}`);
            
            // Log de dados processados (sem PII)
            const processedFields = Object.keys(user_data).filter(key => 
                !['client_ip_address', 'client_user_agent'].includes(key)
            );
            console.log(`✅ Campos processados: ${processedFields.join(', ')}`);
        } else {
            console.error(`❌ CAPI Error: ${result.message}`);
        }

    return res.json({
    ok: true,
    event_name,
    event_id: eventPayload.data[0].event_id,
    success: result.success || false,
    fbtrace_id: result.fbtrace_id || null,
    error: result.error || null
    });



    } catch (error) {
        console.error("FURION CAPI Error:", error);
        
        return res.status(500).json({
        ok: false,
        error: "Internal server error",
        message: error.message,
        event_name: req.body.event_name || "unknown",
        timestamp: new Date().toISOString()
        });
    }
    });



// FURION POWER - Health check endpoint
app.get("/health", (req, res) => {
  const configured = !!ACCESS_TOKEN;
  
  res.json({
  status: "healthy",
  pixel_configured: configured,
  api_version: API_VERSION,
  test_mode: !!TEST_EVENT_CODE,
  timestamp: new Date().toISOString()
  });
});



// FURION POWER - Pixel configuration endpoint
app.get("/pixels", (req, res) => {
  res.json({
    pixel_id: PIXEL_ID,
    configured: !!ACCESS_TOKEN,
    masked_token: ACCESS_TOKEN ? ACCESS_TOKEN.substring(0, 8) + "..." : null
  });
});



// FURION POWER - Test endpoint
app.post("/test", async (req, res) => {
  try {
    const testPayload = {
      data: [{
        event_name: "Test",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `test_${Date.now()}`,
        action_source: "website",
        user_data: {
          em: sha256("test@teste.com")
        }
      }]
    };

    if (TEST_EVENT_CODE) {
      testPayload.test_event_code = TEST_EVENT_CODE;
    }

    const result = await sendToPixel(testPayload);

    res.json({
      test: true,
      success: result.success || false,
      response: result
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});



// FURION POWER - Analytics endpoint
app.get("/analytics", (req, res) => {
  // This could be expanded to include more detailed analytics
  res.json({
    service: "FURION POWER CAPI Analytics",
    message: "Analytics endpoint - implement based on your needs",
    available_endpoints: [
      "GET /health - Service health check",
      "GET /pixels - Pixel configuration info", 
      "POST /test - Test all configured pixels",
      "POST /event - Send events to pixels",
      "GET /analytics - This endpoint"
    ]
  });
});



// FURION POWER - Error handling middleware
app.use((err, req, res, next) => {
  console.error('FURION CAPI Unhandled Error:', err);
  
  res.status(500).json({
    ok: false,
    error: "Internal server error",
    message: "An unexpected error occurred",
    timestamp: new Date().toISOString()
  });
});



// FURION POWER - 404 handler
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Endpoint not found",
    message: `${req.method} ${req.path} is not available`,
    available_endpoints: ["/event", "/health", "/pixels", "/test", "/analytics"]
  });
});



// FURION POWER - Server startup
const PORT = process.env.PORT || 3000;



app.listen(PORT, () => {
  console.log(`🔥 FURION POWER CAPI Server running on port ${PORT}`);
  console.log(`📡 Pixel configurado: ${ACCESS_TOKEN ? 'SIM' : 'NÃO'}`);
  console.log(`⚡ API Version: ${API_VERSION}`);
  console.log(`🧪 Test mode: ${TEST_EVENT_CODE ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🚀 Ready to dominate conversions!`);
});



// FURION POWER - Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔥 FURION CAPI: Received SIGTERM, shutting down gracefully');
  process.exit(0);
});



process.on('SIGINT', () => {
  console.log('🔥 FURION CAPI: Received SIGINT, shutting down gracefully');  
  process.exit(0);
});



export default app;