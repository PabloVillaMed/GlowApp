/* GlowApp — the reminder cast.
   Three original characters who send the reminders as chat messages, each
   with a voice note. Everything a character says lives here, in both
   languages, because the same line is shown in the chat, posted in the
   notification and spoken in the voice note: tools/voices/make-voices.js
   reads this file to record them.

   Each habit has three lines per character, so a reminder that fires every
   day (or several times a day) does not say the same thing each time. There
   are also four generic lines, for habits the user typed, and five answers
   for when a habit is done.

   Lines are written to be heard. Short, no symbols, no digits, no times of
   day (the user picks when a reminder fires), and nothing that assumes the
   listener's gender. A generic line has a separate spoken version because
   its text names a habit the user typed, which no recording can know. */
(function (global) {
  'use strict';

  /* The order is the order of the picker. `accent` tints the chat bubbles.
     El Crack and Abuela Rosa were retired in 2.20: app.js lets go of a
     choice or a chat that still names them. */
  const CAST = [
    { id: 'narrator', accent: '#7B5CE0' },
    { id: 'bip', accent: '#1597B8' },
    { id: 'zen', accent: '#C98A1E' },
  ];

  const LINES = {
    narrator: {
      es: {
        name: 'El Narrador',
        tagline: 'Convierte cada recordatorio en una pequeña historia de misterio.',
        intro: 'Soy El Narrador. A partir de hoy, cada recordatorio llegará con una historia... si te atreves a escucharla.',
        habits: {
          meditate: [
            'Cuentan que quien nunca se detiene a respirar acaba oyendo susurros en su cabeza. Unos minutos de silencio los callan.',
            'En una habitación tranquila, alguien cerró los ojos y el ruido del mundo se apagó. Esta vez, ese alguien eres tú.',
            'Dicen que hay un silencio que solo encuentra quien se sienta a buscarlo. Hoy podrías encontrarlo.',
          ],
          gratitude: [
            'Existe un cuaderno que solo brilla cuando alguien escribe tres cosas buenas. Haz que brille hoy.',
            'Dicen que las cosas buenas se desvanecen si nadie las anota. Atrapa tres antes de que escapen.',
            'Una vieja leyenda asegura que quien agradece tres cosas cada día nunca está del todo solo. Escríbelas.',
          ],
          journal: [
            'Las ideas que no se escriben vagan por la casa de noche, buscando dueño. Atrápalas en el papel.',
            'Hay un diario en tu escritorio que guarda silencio desde hace días. Dicen que espera tu letra.',
            'Lo que callas pesa. Lo que escribes, flota. Escribe un rato, y verás.',
          ],
          selfcare: [
            'El cansancio es un fantasma paciente. Solo se marcha cuando te regalas un rato para ti.',
            'Una vez, alguien olvidó cuidarse durante tanto tiempo que se volvió transparente. Que no te pase.',
            'Hoy la casa guarda un rincón solo para ti. Ve a él, antes de que la prisa lo reclame.',
          ],
          walk: [
            'Dicen que hay un sendero que solo aparece para quien sale a caminar. Hoy podría aparecer para ti.',
            'Las calles cuentan secretos a quien las recorre despacio. Sal a escuchar alguno.',
            'Alguien dejó huellas frescas en la acera, esperando que las sigan. Sal a caminar.',
          ],
          run: [
            'Algo te persigue: la versión de ti que se quedó en el sofá. Corre, y que no te alcance.',
            'Cuando el viento sopla fuerte, dicen que llama a los corredores. Hoy te llama a ti.',
            'Corre. No porque algo te persiga, sino porque algo te espera al final del camino.',
          ],
          strength: [
            'En lo profundo del gimnasio, las pesas murmuran tu nombre. No las hagas esperar más.',
            'Cuentan que cada repetición forja una armadura invisible. Hoy toca añadirle otra pieza.',
            'Las pesas llevan días quietas en el rincón. Si no las levantas tú, quién sabe quién lo hará.',
          ],
          bike: [
            'Una bicicleta abandonada gira sus ruedas sola, esperando a alguien. Ese alguien eres tú.',
            'Dicen que hay caminos que solo se abren para quien llega pedaleando. Sal a buscarlos.',
            'El timbre de la bicicleta sonó solo hace un momento. Quizá sea una señal.',
          ],
          stretch: [
            '¿Oyes ese crujido? No es la casa. Es tu espalda pidiendo que estires. Hazle caso.',
            'Tu cuerpo guarda nudos como una casa vieja guarda secretos. Estira, y deja que se suelten.',
            'Dicen que quien nunca estira acaba convertido en estatua. Muévete, por si acaso.',
          ],
          water: [
            'Dicen que quien olvida su vaso de agua empieza a secarse, lentamente, como una planta olvidada. Bebe agua ya.',
            'En la cocina, un vaso vacío espera. Dicen que se inquieta cuando nadie lo llena.',
            'Una gota cae en el silencio... y luego otra. Es la señal: hora de beber agua.',
          ],
          fruit: [
            'En la cocina, una fruta espera desde hace días. Si no la comes tú, nadie sabe qué pasará.',
            'La manzana del frutero brilla de una forma extraña. Quizá te esté pidiendo que la comas.',
            'Dicen que la fruta olvidada se convierte en leyenda. Mejor cómetela antes.',
          ],
          veggies: [
            'Las verduras que nadie come se reúnen de noche a planear su venganza. Mejor ponlas en tu plato.',
            'En lo más hondo de la nevera, un brócoli espera su oportunidad. Dásela hoy.',
            'Cuenta la leyenda que un plato sin verde nunca sacia del todo. Compruébalo con verduras.',
          ],
          vitamins: [
            'Un frasco de vitaminas tiembla en el estante. Lleva horas esperando que lo recuerdes.',
            'Hay un frasco pequeño que guarda tu energía de mañana. Ábrelo y toma la de hoy.',
            'Dicen que las vitaminas olvidadas cuentan los días. No las hagas esperar más.',
          ],
          skincare: [
            'El espejo lo recuerda todo. Dale hoy dos minutos de cuidado que valga la pena recordar.',
            'Frente al espejo, una figura conocida te observa. Cuídala dos minutos; se lo merece.',
            'Cuentan que la piel guarda la memoria de cada día. Regálale uno bueno.',
          ],
          sunlight: [
            'Las criaturas de la sombra odian la luz del sol. Sal un rato, que no te confundan con una.',
            'Por una ventana entreabierta entra un rayo de luz que te busca. Sal a encontrarlo.',
            'Dicen que el sol guarda un mensaje para quien sale a su encuentro. Ve a escucharlo.',
          ],
          sleepEarly: [
            'Cada minuto que le robas a la noche, la noche te lo cobra mañana. Ve a dormir temprano.',
            'El reloj avanza en silencio y la almohada te llama por tu nombre. Ve con ella.',
            'Dicen que los sueños más bonitos llegan temprano y se van si no hay nadie. No los hagas esperar.',
          ],
          noPhoneBed: [
            'Dicen que el brillo del teléfono en la cama atrae a las ojeras. Déjalo fuera del cuarto.',
            'En la oscuridad, una pantalla encendida es un faro para el insomnio. Apágala y déjala lejos.',
            'El teléfono quiere contarte una historia más. No le hagas caso: esta noche, la historia es dormir.',
          ],
          nightRoutine: [
            'La casa empieza a apagarse. Baja las luces, aleja las pantallas, y deja que la calma entre.',
            'Las sombras se alargan y el día se despide. Prepara tu ritual: luz tenue y silencio.',
            'Dicen que la noche trae calma a quien la recibe sin prisas. Prepárate para recibirla.',
          ],
          read: [
            'Hay un libro que te espera con la página marcada. Dicen que se pone triste si no vuelves.',
            'Entre las páginas de tu libro hay un secreto que aún no conoces. Sigue leyendo.',
            'Cada página leída enciende una vela en algún lugar. Enciende unas cuantas hoy.',
          ],
          study: [
            'Cuentan que el conocimiento solo aparece en el silencio. Apaga las notificaciones y empieza a estudiar.',
            'La biblioteca guarda silencio para ti. Siéntate, y que empiece la sesión.',
            'Dicen que quien estudia sin distracciones descubre puertas que otros no ven. Ábrelas hoy.',
          ],
          planDay: [
            'Quien no planea su día se pierde en él, como en un laberinto. Traza tu mapa ahora.',
            'Ante ti hay un día sin mapa. Dibuja el camino antes de que el día lo dibuje por ti.',
            'Tres tareas importantes esperan entre la niebla. Nómbralas, y la niebla se irá.',
          ],
          tidy: [
            'Ese montón de cosas en la esquina... ¿se ha movido? Mejor ordénalo antes de averiguarlo.',
            'Dicen que lo que se esconde en el desorden nunca vuelve a aparecer. Ordena antes de perder algo más.',
            'La habitación respira mejor cuando cada cosa vuelve a su lugar. Devuélvelas.',
          ],
          callSomeone: [
            'Alguien piensa en ti en este momento. Rompe el silencio: escríbele o llámale hoy.',
            'Hay una conversación pendiente flotando en el aire. Solo tú puedes empezarla.',
            'Dicen que las voces queridas se apagan si nadie las llama. Llama hoy a alguien.',
          ],
          brushTeeth: [
            'En el baño, un cepillo espera en silencio. Dicen que dos minutos con él hacen que una sonrisa brille en la oscuridad.',
            'Cuentan que las caries trabajan en las sombras. Cepíllate ahora y déjalas sin historia que contar.',
            'Un reflejo te sonríe desde el espejo. Dale dos minutos de cepillo; quiere seguir sonriendo.',
          ],
          floss: [
            'Entre los dientes se esconden secretos que el cepillo nunca encuentra. El hilo dental sí.',
            'Un hilo fino, una misión silenciosa. Pásalo entre cada diente y que nada quede escondido.',
            'Dicen que las encías recuerdan cada olvido. Hoy dales un buen recuerdo: hilo dental.',
          ],
          noFap: [
            'Esta historia trata de alguien que decidió llevar las riendas. Hoy escribe otro capítulo de su racha.',
            'Una tentación ronda por la casa. Dicen que se desvanece si sales a caminar o hablas con alguien. Pruébalo.',
            'Cuentan que cada día del reto deja una marca invisible de fuerza. Hoy sumas otra.',
          ],
        },
        generic: [
          { text: 'Dicen que «{habit}» lleva un rato esperando en la oscuridad... Ve antes de que se impaciente.',
            voice: 'Dicen que hay un hábito esperándote en la oscuridad... Ve antes de que se impaciente.' },
          { text: 'Esta historia aún no tiene final. Lo escribes tú, con «{habit}».',
            voice: 'Esta historia aún no tiene final. Lo escribes tú, ahora mismo.' },
          { text: 'Algo se mueve en tu lista: «{habit}». Mejor atenderlo antes de que oscurezca.',
            voice: 'Algo se mueve en tu lista de hoy. Mejor atenderlo antes de que oscurezca.' },
          { text: 'Las campanas suenan por «{habit}». Ya sabes lo que significa.',
            voice: 'Las campanas suenan por un hábito pendiente. Ya sabes lo que significa.' },
        ],
        praise: [
          'Y así, la maldición se rompió. Bien hecho.',
          'La historia de hoy tiene un final feliz. Por ahora...',
          'El fantasma se ha ido. Esta vez, ganaste tú.',
          'Otra página escrita. La leyenda continúa.',
          'Las sombras retroceden. Has cumplido.',
        ],
      },
      en: {
        name: 'The Narrator',
        tagline: 'Turns every reminder into a little spooky story.',
        intro: 'I am The Narrator. From today, every reminder will come with a story... if you dare to listen.',
        habits: {
          meditate: [
            'They say those who never stop to breathe end up hearing whispers in their head. A few quiet minutes will silence them.',
            'In a quiet room, someone closed their eyes and the noise of the world went out. This time, that someone is you.',
            'They say there is a silence that only appears to those who sit and look for it. Today you might find it.',
          ],
          gratitude: [
            'There is a notebook that only glows when someone writes down three good things. Make it glow today.',
            'They say good things fade away if no one writes them down. Catch three before they escape.',
            'An old legend says whoever gives thanks for three things each day is never truly alone. Write them down.',
          ],
          journal: [
            'Thoughts that are never written down wander the house at night, looking for their owner. Catch them on paper.',
            'A diary on your desk has been silent for days. They say it is waiting for your handwriting.',
            'What you keep inside grows heavy. What you write down floats. Write for a while, and see.',
          ],
          selfcare: [
            'Tiredness is a patient ghost. It only leaves when you give yourself some time of your own.',
            "Once, someone forgot to look after themselves for so long that they turned transparent. Don't let it happen to you.",
            'Today the house is keeping a corner just for you. Go to it, before the rush claims it.',
          ],
          walk: [
            'They say there is a path that only appears to those who go out walking. Today it might appear for you.',
            'The streets tell their secrets to those who walk them slowly. Go and hear one.',
            'Someone left fresh footprints on the pavement, hoping to be followed. Go for a walk.',
          ],
          run: [
            "Something is chasing you: the version of you that stayed on the couch. Run, and don't let it catch you.",
            'When the wind blows hard, they say it is calling the runners. Today it is calling you.',
            'Run. Not because something is behind you, but because something waits at the end of the road.',
          ],
          strength: [
            "Deep in the gym, the weights are whispering your name. Don't keep them waiting.",
            'They say every rep forges a piece of invisible armour. Today, add another piece.',
            "The weights have sat still in the corner for days. If you don't lift them, who knows who will.",
          ],
          bike: [
            'An abandoned bicycle spins its wheels all by itself, waiting for someone. That someone is you.',
            'They say some roads only open for those who arrive pedalling. Go and find them.',
            'The bicycle bell rang on its own a moment ago. Perhaps it was a sign.',
          ],
          stretch: [
            "Do you hear that creak? It's not the house. It's your back, begging you to stretch. Listen to it.",
            'Your body keeps knots the way an old house keeps secrets. Stretch, and let them go.',
            'They say whoever never stretches slowly turns into a statue. Move, just in case.',
          ],
          water: [
            'They say whoever forgets their glass of water begins to dry up, slowly, like a forgotten plant. Drink some water now.',
            'In the kitchen, an empty glass is waiting. They say it grows restless when no one fills it.',
            'A drop falls in the silence... then another. That is the sign: time to drink some water.',
          ],
          fruit: [
            "In the kitchen, a piece of fruit has been waiting for days. If you don't eat it, nobody knows what will happen.",
            'The apple in the fruit bowl is shining strangely. Perhaps it wants to be eaten.',
            'They say forgotten fruit turns into legend. Better eat it first.',
          ],
          veggies: [
            'Uneaten vegetables gather at night to plot their revenge. Better put them on your plate.',
            'Deep in the fridge, a broccoli waits for its chance. Give it one today.',
            'Legend has it that a plate with no green never truly satisfies. Test it with some vegetables.',
          ],
          vitamins: [
            'A bottle of vitamins trembles on the shelf. It has waited for hours for you to remember it.',
            "A small bottle holds tomorrow's energy. Open it, and take today's.",
            "They say forgotten vitamins count the days. Don't keep them waiting.",
          ],
          skincare: [
            'The mirror remembers everything. Give it two minutes of care worth remembering.',
            'In front of the mirror, a familiar figure is watching you. Look after it for two minutes; it deserves it.',
            'They say skin keeps a memory of every day. Give it a good one.',
          ],
          sunlight: [
            'Creatures of the shadows hate sunlight. Step outside for a while, so no one mistakes you for one.',
            'A half-open window lets in a ray of light that is looking for you. Go out and find it.',
            'They say the sun keeps a message for whoever goes out to meet it. Go and hear it.',
          ],
          sleepEarly: [
            'Every minute you steal from the night, the night collects tomorrow. Go to bed early.',
            'The clock moves on in silence, and the pillow is calling your name. Go to it.',
            "They say the sweetest dreams arrive early and leave if no one is there. Don't keep them waiting.",
          ],
          noPhoneBed: [
            "They say a phone's glow in bed summons dark circles. Leave it outside the room.",
            'In the dark, a lit screen is a lighthouse for sleeplessness. Switch it off and leave it far away.',
            "The phone wants to tell you one more story. Don't listen. Tonight, the story is sleep.",
          ],
          nightRoutine: [
            'The house is going quiet. Dim the lights, put the screens away, and let the calm come in.',
            'The shadows grow long and the day says goodbye. Prepare your ritual: low light and silence.',
            'They say the night brings calm to those who welcome it unhurried. Get ready to welcome it.',
          ],
          read: [
            "A book is waiting for you, its page still marked. They say it grows sad if you don't come back.",
            "Between the pages of your book lies a secret you don't know yet. Keep reading.",
            'Every page you read lights a candle somewhere. Light a few today.',
          ],
          study: [
            'Legend has it that knowledge only appears in silence. Turn off notifications and start studying.',
            'The library keeps silent for you. Sit down, and let the session begin.',
            'They say those who study without distraction find doors others never see. Open them today.',
          ],
          planDay: [
            "Whoever doesn't plan their day gets lost in it, like in a maze. Draw your map now.",
            'Before you lies a day with no map. Draw the path before the day draws it for you.',
            'Three important tasks wait in the fog. Name them, and the fog will lift.',
          ],
          tidy: [
            'That pile of things in the corner... did it just move? Better tidy it before you find out.',
            'They say whatever hides in the clutter is never seen again. Tidy up before you lose anything else.',
            'The room breathes better when everything returns to its place. Send them home.',
          ],
          callSomeone: [
            'Someone is thinking of you right now. Break the silence: call or text them today.',
            'An unfinished conversation is floating in the air. Only you can start it.',
            'They say beloved voices fade if no one calls them. Call someone today.',
          ],
          brushTeeth: [
            'In the bathroom, a toothbrush waits in silence. They say two minutes with it make a smile glow in the dark.',
            'They say cavities work in the shadows. Brush now, and leave them no story to tell.',
            'A reflection smiles at you from the mirror. Give it two minutes of brushing; it wants to keep smiling.',
          ],
          floss: [
            'Between your teeth hide secrets the brush never finds. The floss does.',
            'A thin thread, a silent mission. Pass it between every tooth, and leave nothing hidden.',
            'They say gums remember every time they were forgotten. Give them a good memory today: floss.',
          ],
          noFap: [
            'This story is about someone who chose to hold the reins. Today they write another chapter of their streak.',
            'A temptation wanders the house. They say it fades if you go for a walk or talk to someone. Try it.',
            'They say every day of the challenge leaves an invisible mark of strength. Today you add another.',
          ],
        },
        generic: [
          { text: 'They say “{habit}” has been waiting in the dark for a while... Go before it grows impatient.',
            voice: 'They say a habit is waiting for you in the dark... Go before it grows impatient.' },
          { text: 'This story has no ending yet. You write it, with “{habit}”.',
            voice: 'This story has no ending yet. You write it, right now.' },
          { text: 'Something stirs on your list: “{habit}”. Better see to it before dark.',
            voice: "Something stirs on today's list. Better see to it before dark." },
          { text: 'The bells are ringing for “{habit}”. You know what that means.',
            voice: 'The bells are ringing for an unfinished habit. You know what that means.' },
        ],
        praise: [
          'And so, the curse was broken. Well done.',
          "Today's story has a happy ending. For now...",
          'The ghost is gone. This time, you won.',
          'Another page written. The legend continues.',
          'The shadows retreat. You kept your word.',
        ],
      },
    },

    bip: {
      es: {
        name: 'Bip',
        tagline: 'Un robot con humor seco y un dato para todo.',
        intro: 'Bip. Unidad de recordatorios activada. Mi misión: que cumplas tus hábitos. Mi sentido del humor: en pruebas.',
        habits: {
          meditate: [
            'Bip. Detecto exceso de pensamientos por segundo. Recomiendo reinicio: unos minutos de meditación.',
            'Bip. Se recomienda modo avión mental. Cierra los ojos y respira durante unos minutos.',
            'Bip. Desfragmentando mente humana. Por favor, no se mueva durante la meditación.',
          ],
          gratitude: [
            'Bip. Tarea pendiente: registrar tres cosas buenas. Mi base de datos indica que siempre hay al menos tres.',
            'Bip. Solicito tres registros positivos del día. Formato: libre. Emoción: opcional, pero recomendada.',
            'Bip. Los humanos agradecidos duermen mejor. Lo leí en un artículo. Escribe tres cosas buenas.',
          ],
          journal: [
            'Bip. Tu memoria está al noventa por ciento. Libera espacio: escribe un rato.',
            'Bip. Detecto pensamientos sin guardar. Se recomienda copia de seguridad en tu cuaderno.',
            'Bip. Escribir unos minutos reduce el ruido interno. Es un dato, no una opinión.',
          ],
          selfcare: [
            'Bip. Nivel de batería personal: bajo. Recarga con un rato para ti, sin pantallas. Incluida la mía.',
            'Bip. Mantenimiento preventivo del humano: un rato de descanso, sin tareas.',
            'Bip. He calculado tu necesidad de descanso. Resultado: alta. Hazme caso.',
          ],
          walk: [
            'Bip. Llevas demasiado tiempo en modo reposo. Activa las piernas: es hora de caminar.',
            'Bip. Objetivo de pasos aún no alcanzado. Recomiendo un paseo. Yo no tengo piernas. Tú sí.',
            'Bip. Un paseo corto mejora el ánimo de forma medible. Sal a caminar.',
          ],
          run: [
            'Bip. Rutina de carrera cargada. Calzado: requerido. Excusas: no compatibles.',
            'Bip. Velocidad recomendada: la tuya. Distancia recomendada: la de hoy. Sal a correr.',
            'Bip. Simulación completada: si sales a correr ahora, te sentirás mejor. Precisión: alta.',
          ],
          strength: [
            'Bip. Los humanos fuertes viven más. Lo dicen mis datos. Hora de entrenar fuerza.',
            'Bip. Actualización de músculos disponible. Instalación: unas series de ejercicios.',
            'Bip. Yo levanto datos. Tú levanta pesas. Reparto de tareas justo.',
          ],
          bike: [
            'Bip. Vehículo de dos ruedas detectado sin uso. Sugerencia: pedalear un rato.',
            'Bip. Tu bicicleta no tiene batería, pero tú sí. Úsala un rato.',
            'Bip. Ruta sugerida: cualquiera, siempre que sea en bicicleta.',
          ],
          stretch: [
            'Bip. Mis sensores detectan una postura de signo de interrogación. Estira la espalda.',
            'Bip. Rigidez detectada en el chasis humano. Ejecutar estiramientos durante cinco minutos.',
            'Bip. Un humano que estira es un humano que cruje menos. Comprobado.',
          ],
          water: [
            'Bip. Nivel de hidratación preocupante. Ingresar un vaso de agua. Repito: un vaso de agua.',
            'Bip. Aviso de refrigeración: los humanos funcionan con agua. Bebe un vaso.',
            'Bip. Tu cuerpo es sesenta por ciento agua. Mantengamos ese porcentaje. Bebe ahora.',
          ],
          fruit: [
            'Bip. Escaneando cocina. Fruta encontrada. Probabilidad de que la comas ahora: esperemos que alta.',
            'Bip. Recomendación nutricional: una fruta. Es mejor que mi dieta de electricidad.',
            'Bip. Detecto azúcar natural disponible en forma de fruta. Procede a consumirla.',
          ],
          veggies: [
            'Bip. Análisis del plato: verde insuficiente. Añadir verduras para continuar.',
            'Bip. Error en el plato: faltan verduras. Corrige el error y vuelve a intentarlo.',
            'Bip. Las verduras son el código fuente de un cuerpo sano. Inclúyelas hoy.',
          ],
          vitamins: [
            'Bip. Recordatorio prioritario: vitaminas. No lo digo yo, lo dice tu receta.',
            'Bip. Paquete de vitaminas pendiente de instalación. Tomar con agua.',
            'Bip. Mi registro indica que hoy no has tomado tus vitaminas. Corrígeme si me equivoco.',
          ],
          skincare: [
            'Bip. Mantenimiento de la carcasa externa, es decir, tu piel. Duración estimada: dos minutos.',
            'Bip. Se recomienda proteger la superficie. Aplica tu crema. Yo uso funda.',
            'Bip. La piel es el órgano más grande del cuerpo humano. Merece dos minutos de atención.',
          ],
          sunlight: [
            'Bip. Tus paneles solares necesitan carga. Sal a tomar el sol un rato.',
            'Bip. Detecto déficit de luz natural. Recomendación: diez minutos al aire libre.',
            'Bip. Los humanos fabrican vitamina D con el sol. Yo no puedo. Aprovéchalo tú.',
          ],
          sleepEarly: [
            'Bip. Es hora de apagar el sistema. Los humanos sin dormir funcionan peor que yo sin batería.',
            'Bip. Iniciando cuenta atrás para el apagado. Ve a la cama ahora.',
            'Bip. Mis cálculos dicen que dormir temprano mejora tu rendimiento de mañana. Apaga la luz.',
          ],
          noPhoneBed: [
            'Bip. Como dispositivo, te lo digo con cariño: deja el teléfono fuera de la cama.',
            'Bip. Los dispositivos también descansamos. Deja el teléfono lejos y duerme.',
            'Bip. Conexión nocturna con el teléfono: no recomendada. Desconecta y descansa.',
          ],
          nightRoutine: [
            'Bip. Iniciando modo nocturno. Bajar brillo, cerrar aplicaciones, preparar descanso.',
            'Bip. Secuencia de apagado: luces tenues, pantallas fuera, mente en calma.',
            'Bip. Ejecutando rutina de noche. Por favor, espere mientras el humano se relaja.',
          ],
          read: [
            'Bip. Descarga de conocimiento disponible. Formato: libro. Velocidad: la tuya.',
            'Bip. Leer unas páginas amplía tu base de datos. Recomendado.',
            'Bip. Yo leo millones de palabras por segundo. A ti te bastan unas páginas. Adelante.',
          ],
          study: [
            'Bip. Modo concentración activado. Notificaciones silenciadas. Bueno, todas menos yo.',
            'Bip. Bloque de estudio programado. Duración: veinticinco minutos. Distracciones: cero.',
            'Bip. Procesando motivación... completado. Hora de estudiar.',
          ],
          planDay: [
            'Bip. Calculando la ruta óptima de tu día. Introduce tus prioridades para continuar.',
            'Bip. Un día sin plan es como un programa sin instrucciones. Escribe tus tres prioridades.',
            'Bip. Planificación diaria pendiente. Tiempo estimado: cinco minutos. Beneficio estimado: alto.',
          ],
          tidy: [
            'Bip. Desorden detectado en tu entorno. Ejecutar protocolo de orden: diez minutos.',
            'Bip. Espacio de trabajo fragmentado. Recomiendo una limpieza de diez minutos.',
            'Bip. Si yo tuviera manos, ordenaría por ti. No tengo. Lo siento.',
          ],
          callSomeone: [
            'Bip. Los humanos necesitan a otros humanos. Es un dato. Llama a alguien que quieras.',
            'Bip. Conexión humana pendiente. Ninguna red la sustituye. Llama a alguien.',
            'Bip. Detecto contactos sin actividad reciente. Envía un mensaje a alguien querido.',
          ],
          brushTeeth: [
            'Bip. Mantenimiento dental programado. Duración recomendada: dos minutos. Inicia el cepillado.',
            'Bip. Dato: el esmalte dental es el tejido más duro del cuerpo humano. Aun así, necesita cepillo.',
            'Bip. Detecto una sonrisa sin limpiar. Aplica cepillo y pasta. Yo solo necesito un paño.',
          ],
          floss: [
            'Bip. El cepillo no alcanza entre los dientes. Para eso existe el hilo dental. Procede.',
            'Bip. Limpieza de espacios intermedios pendiente. Herramienta requerida: hilo dental.',
            'Bip. Revisión de encías: aprobada si usas hilo dental hoy. Te espero.',
          ],
          noFap: [
            'Bip. Reto en curso. Racha activa. Te recomiendo no interrumpir el proceso.',
            'Bip. Si aparece un impulso, cambia de tarea: caminar, ducharte o hablar con alguien. Es un buen protocolo.',
            'Bip. Los impulsos suben y bajan como una ola. Espera unos minutos y pasarán. Yo cronometro.',
          ],
        },
        generic: [
          { text: 'Bip. Tarea pendiente: «{habit}». Prioridad: alta. Excusas: no compatibles.',
            voice: 'Bip. Tienes una tarea pendiente. Prioridad: alta. Excusas: no compatibles.' },
          { text: 'Bip. Mi calendario interno dice que toca «{habit}». Mi calendario nunca se equivoca.',
            voice: 'Bip. Mi calendario interno dice que toca un hábito. Mi calendario nunca se equivoca.' },
          { text: 'Bip. Alerta amable: «{habit}» sigue pendiente. Esta es la versión educada del aviso.',
            voice: 'Bip. Alerta amable: tienes un hábito pendiente. Esta es la versión educada del aviso.' },
          { text: 'Bip. Ejecutando «{habit}» en tres, dos, uno... Bueno, eso lo tienes que hacer tú.',
            voice: 'Bip. Ejecutando tu hábito en tres, dos, uno... Bueno, eso lo tienes que hacer tú.' },
        ],
        praise: [
          'Bip. Tarea completada. Satisfacción del sistema: cien por cien.',
          'Bip bip. Esto que siento debe ser orgullo. Bien hecho.',
          'Bip. Registro guardado. Humano: excelente. Robot: impresionado.',
          'Bip. Hábito completado. Actualizando tu racha... listo.',
          'Bip bip bip. En mi idioma, eso significa felicidad.',
        ],
      },
      en: {
        name: 'Bip',
        tagline: 'A robot with dry humour and a fact for everything.',
        intro: 'Beep. Reminder unit activated. My mission: help you keep your habits. My sense of humour: still in testing.',
        habits: {
          meditate: [
            'Beep. Detecting too many thoughts per second. Recommended action: reboot with a few minutes of meditation.',
            'Beep. Mental airplane mode recommended. Close your eyes and breathe for a few minutes.',
            'Beep. Defragmenting human mind. Please remain still during meditation.',
          ],
          gratitude: [
            'Beep. Pending task: log three good things. My database says there are always at least three.',
            'Beep. Requesting three positive entries for today. Format: free. Emotion: optional, but recommended.',
            'Beep. Grateful humans sleep better. I read it in an article. Write down three good things.',
          ],
          journal: [
            'Beep. Your memory is at ninety percent. Free up some space: write for a while.',
            'Beep. Unsaved thoughts detected. Backup recommended, in your notebook.',
            'Beep. Writing for a few minutes reduces internal noise. That is a fact, not an opinion.',
          ],
          selfcare: [
            'Beep. Personal battery level: low. Recharge with some time for yourself. No screens. Including mine.',
            'Beep. Preventive human maintenance: some rest, with no tasks.',
            'Beep. I have calculated your need for rest. Result: high. Please comply.',
          ],
          walk: [
            'Beep. You have been in standby for too long. Activate legs: it is time for a walk.',
            'Beep. Step goal not yet reached. A walk is recommended. I have no legs. You do.',
            'Beep. A short walk improves mood, measurably. Go for a walk.',
          ],
          run: [
            'Beep. Running routine loaded. Shoes: required. Excuses: not supported.',
            "Beep. Recommended speed: yours. Recommended distance: today's. Go for a run.",
            'Beep. Simulation complete: if you run now, you will feel better. Accuracy: high.',
          ],
          strength: [
            'Beep. Strong humans live longer. My data says so. Time for strength training.',
            'Beep. Muscle update available. Installation: a few sets of exercises.',
            'Beep. I lift data. You lift weights. A fair division of labour.',
          ],
          bike: [
            'Beep. Two-wheeled vehicle detected, unused. Suggestion: go for a ride.',
            'Beep. Your bicycle has no battery, but you do. Use it for a while.',
            'Beep. Suggested route: any route, as long as it is by bike.',
          ],
          stretch: [
            'Beep. My sensors detect a posture shaped like a question mark. Stretch your back.',
            'Beep. Stiffness detected in the human chassis. Run stretches for five minutes.',
            'Beep. A human who stretches is a human who creaks less. Verified.',
          ],
          water: [
            'Beep. Hydration levels concerning. Insert one glass of water. Repeat: one glass of water.',
            'Beep. Cooling reminder: humans run on water. Drink a glass.',
            'Beep. Your body is sixty percent water. Let us keep that percentage. Drink now.',
          ],
          fruit: [
            'Beep. Scanning kitchen. Fruit found. Probability you eat it now: hopefully high.',
            'Beep. Nutritional recommendation: one piece of fruit. Better than my diet of electricity.',
            'Beep. Natural sugar available in fruit form. Proceed to consume.',
          ],
          veggies: [
            'Beep. Plate analysis: insufficient green. Add vegetables to continue.',
            'Beep. Plate error: vegetables missing. Fix the error and try again.',
            'Beep. Vegetables are the source code of a healthy body. Include them today.',
          ],
          vitamins: [
            "Beep. Priority reminder: vitamins. Not my words, your prescription's.",
            'Beep. Vitamin package pending installation. Take with water.',
            'Beep. My log shows no vitamins taken today. Correct me if I am wrong.',
          ],
          skincare: [
            'Beep. Outer casing maintenance, meaning your skin. Estimated duration: two minutes.',
            'Beep. Surface protection recommended. Apply your cream. I use a phone case.',
            'Beep. Skin is the largest organ of the human body. It deserves two minutes of attention.',
          ],
          sunlight: [
            'Beep. Your solar panels need charging. Go outside and get some sun.',
            'Beep. Natural light deficit detected. Recommendation: ten minutes outdoors.',
            'Beep. Humans make vitamin D from sunlight. I cannot. You should take advantage.',
          ],
          sleepEarly: [
            'Beep. Time to shut down the system. Humans without sleep run worse than me without a battery.',
            'Beep. Starting shutdown countdown. Go to bed now.',
            "Beep. My calculations say an early night improves tomorrow's performance. Lights off.",
          ],
          noPhoneBed: [
            'Beep. As a device, I say this with love: keep the phone out of the bed.',
            'Beep. Devices need rest too. Leave the phone far away and sleep.',
            'Beep. Overnight connection with the phone: not recommended. Disconnect and rest.',
          ],
          nightRoutine: [
            'Beep. Starting night mode. Lower brightness, close apps, prepare for rest.',
            'Beep. Shutdown sequence: dim lights, screens away, calm mind.',
            'Beep. Running night routine. Please wait while the human relaxes.',
          ],
          read: [
            'Beep. Knowledge download available. Format: book. Speed: yours.',
            'Beep. Reading a few pages expands your database. Recommended.',
            'Beep. I read millions of words per second. A few pages will do for you. Go ahead.',
          ],
          study: [
            'Beep. Focus mode on. Notifications silenced. Well, all except me.',
            'Beep. Study block scheduled. Duration: twenty-five minutes. Distractions: zero.',
            'Beep. Processing motivation... complete. Time to study.',
          ],
          planDay: [
            'Beep. Calculating the optimal route for your day. Enter your priorities to continue.',
            'Beep. A day without a plan is a program without instructions. Write down your three priorities.',
            'Beep. Daily planning pending. Estimated time: five minutes. Estimated benefit: high.',
          ],
          tidy: [
            'Beep. Clutter detected in your environment. Run tidying protocol: ten minutes.',
            'Beep. Workspace fragmented. I recommend a ten-minute clean-up.',
            'Beep. If I had hands, I would tidy up for you. I do not. Sorry.',
          ],
          callSomeone: [
            'Beep. Humans need other humans. That is a fact. Call someone you love.',
            'Beep. Human connection pending. No network can replace it. Call someone.',
            'Beep. Contacts with no recent activity detected. Send a message to someone dear.',
          ],
          brushTeeth: [
            'Beep. Scheduled dental maintenance. Recommended duration: two minutes. Begin brushing.',
            'Beep. Fact: tooth enamel is the hardest tissue in the human body. It still needs a brush.',
            'Beep. Uncleaned smile detected. Apply brush and toothpaste. I only need a cloth.',
          ],
          floss: [
            'Beep. The brush cannot reach between your teeth. That is what floss is for. Proceed.',
            'Beep. Cleaning of in-between spaces pending. Required tool: dental floss.',
            'Beep. Gum inspection: passed if you floss today. I will wait.',
          ],
          noFap: [
            'Beep. Challenge in progress. Streak active. I recommend not interrupting the process.',
            'Beep. If an urge appears, switch tasks: walk, shower or talk to someone. It is a good protocol.',
            'Beep. Urges rise and fall like a wave. Wait a few minutes and they pass. I will keep time.',
          ],
        },
        generic: [
          { text: 'Beep. Pending task: “{habit}”. Priority: high. Excuses: not supported.',
            voice: 'Beep. You have a pending task. Priority: high. Excuses: not supported.' },
          { text: 'Beep. My internal calendar says it’s time for “{habit}”. My calendar is never wrong.',
            voice: 'Beep. My internal calendar says it is time for a habit. My calendar is never wrong.' },
          { text: 'Beep. Friendly alert: “{habit}” is still pending. This is the polite version.',
            voice: 'Beep. Friendly alert: you have a habit pending. This is the polite version.' },
          { text: 'Beep. Executing “{habit}” in three, two, one... Well, that part is up to you.',
            voice: 'Beep. Executing your habit in three, two, one... Well, that part is up to you.' },
        ],
        praise: [
          'Beep. Task complete. System satisfaction: one hundred percent.',
          'Beep beep. This feeling must be pride. Well done.',
          'Beep. Entry saved. Human: excellent. Robot: impressed.',
          'Beep. Habit complete. Updating your streak... done.',
          'Beep beep beep. In my language, that means happiness.',
        ],
      },
    },

    zen: {
      es: {
        name: 'Maestro Zen',
        tagline: 'Calma absoluta. Sin prisa, pero sin pausa.',
        intro: 'Respira. Soy el Maestro Zen. Te acompañaré en cada hábito, sin prisa... pero sin pausa.',
        habits: {
          meditate: [
            'Siéntate. Cierra los ojos. Deja que los pensamientos pasen, como nubes en el cielo.',
            'El silencio no está fuera. Está dentro de ti. Siéntate y escúchalo.',
            'Respira hondo. Suelta el aire despacio. Este momento es todo lo que hay.',
          ],
          gratitude: [
            'Mira a tu alrededor con calma. Tres cosas buenas te esperan. Escríbelas.',
            'Quien agradece lo pequeño, recibe lo grande. Escribe tres gratitudes.',
            'El río no pide más agua; agradece la que tiene. Anota tres cosas buenas de hoy.',
          ],
          journal: [
            'La mente es como un río revuelto. Escribe, y el agua volverá a aclararse.',
            'Las palabras escritas son hojas que el viento ya no puede llevarse. Escribe un rato.',
            'Escribe sin juzgar. Lo que sale de ti deja de pesarte por dentro.',
          ],
          selfcare: [
            'Tú también mereces tu propio cuidado. Regálate este momento, sin culpa.',
            'Una lámpara sin aceite no da luz. Cuídate, para poder brillar.',
            'Detente. Haz algo amable por ti. El mundo seguirá girando.',
          ],
          walk: [
            'Camina despacio. Cada paso es una pequeña meditación. El camino te está esperando.',
            'No hace falta llegar a ningún lugar. Basta con caminar y estar presente.',
            'Siente el suelo bajo tus pies. Cada paso te devuelve al presente.',
          ],
          run: [
            'Corre como el viento: sin pelear con nada. Tu ritmo es el ritmo correcto.',
            'Corre con la respiración como guía. El cuerpo conoce el camino.',
            'La montaña no tiene prisa, y aun así toca el cielo. Corre a tu manera.',
          ],
          strength: [
            'El bambú es flexible y fuerte a la vez. Entrena tu cuerpo con paciencia.',
            'La fuerza verdadera nace de la constancia. Una serie más, con atención.',
            'Cada movimiento hecho con presencia construye un cuerpo sereno y fuerte.',
          ],
          bike: [
            'Pedalea sin prisa. Deja que el paisaje cambie, y tu mente con él.',
            'La rueda gira, el viento pasa, la mente se aquieta. Sal a pedalear.',
            'Un camino recorrido en calma vale más que muchos recorridos con prisa.',
          ],
          stretch: [
            'Estira el cuerpo como el árbol que busca la luz. Despacio. Sin forzar.',
            'Escucha a tu cuerpo. Estira hasta donde llega hoy, ni un poco más.',
            'Respira en cada estiramiento. Donde va la respiración, va la calma.',
          ],
          water: [
            'El agua da vida al río, y a ti. Bebe un vaso, con calma.',
            'Sé como el agua: suave y constante. Ahora, bebe un poco.',
            'Un sorbo de agua, bebido con atención, también es meditación.',
          ],
          fruit: [
            'La naturaleza te ofrece su dulzura. Come una fruta, y saboréala.',
            'Come despacio. Cada bocado de fruta es un regalo de la tierra.',
            'El árbol da su fruto sin esperar nada. Acéptalo con gratitud.',
          ],
          veggies: [
            'Un plato con verde es un jardín que te cuida. Come con atención.',
            'Lo que comes se convierte en ti. Elige verduras, elige equilibrio.',
            'Come sin prisa y con colores. El cuerpo agradece la sencillez.',
          ],
          vitamins: [
            'Pequeños gestos, grandes cambios. Es momento de tus vitaminas.',
            'El cuidado diario es como regar una planta. Toma tus vitaminas.',
            'Lo sencillo, hecho cada día, se vuelve fortaleza. Tus vitaminas te esperan.',
          ],
          skincare: [
            'Cuida tu piel como se cuida un jardín: con constancia y con cariño.',
            'Mírate con amabilidad. Dos minutos de cuidado son un acto de respeto.',
            'Cuidar la piel con calma es un pequeño ritual de paz.',
          ],
          sunlight: [
            'El sol no tiene prisa, y aun así lo ilumina todo. Sal a recibir su luz.',
            'Sal un momento. Deja que la luz toque tu rostro. Respira.',
            'La flor busca el sol sin esfuerzo. Haz como ella.',
          ],
          sleepEarly: [
            'La noche llega para descansar. Suelta el día. Es hora de dormir.',
            'Como el sol se oculta sin resistencia, deja tú también que el día termine.',
            'Descansa. Lo que no hiciste hoy puede esperar a mañana.',
          ],
          noPhoneBed: [
            'Deja el teléfono lejos. La cama es un templo para el descanso.',
            'La luz de la pantalla aleja el sueño. Apágala y deja que llegue la calma.',
            'Antes de dormir, desconecta. El silencio también descansa.',
          ],
          nightRoutine: [
            'Baja las luces. Baja el ritmo. Prepara tu mente para la calma de la noche.',
            'La noche es un lago tranquilo. Prepárate para entrar en él, despacio.',
            'Termina el día con gestos lentos. La calma de ahora es el descanso de después.',
          ],
          read: [
            'Un libro es un viaje que se hace en silencio. Lee unas páginas, sin prisa.',
            'Lee con atención plena. Cada palabra es una semilla.',
            'Abre tu libro como quien abre una ventana. Deja entrar algo nuevo.',
          ],
          study: [
            'Una sola tarea. Una sola mente. Estudia ahora, con atención plena.',
            'La gota constante horada la piedra. Un bloque de estudio, hoy.',
            'Estudia sin prisa y sin distracciones. El aprendizaje florece en la calma.',
          ],
          planDay: [
            'Antes de caminar, mira el sendero. Dedica unos minutos a planear tu día.',
            'Una mente ordenada hace un día sereno. Elige tus prioridades.',
            'No es necesario hacerlo todo. Elige lo esencial, y empieza.',
          ],
          tidy: [
            'Un espacio en orden invita a una mente en calma. Ordena un poco, despacio.',
            'Ordenar fuera es ordenar dentro. Diez minutos, con atención.',
            'Devuelve cada cosa a su lugar, como las hojas vuelven a la tierra.',
          ],
          callSomeone: [
            'Las raíces nos sostienen. Habla hoy con alguien a quien quieres.',
            'Una voz amiga es un refugio. Llama a alguien que aprecias.',
            'Compartir un momento con alguien querido alimenta el alma. Escríbele hoy.',
          ],
          brushTeeth: [
            'Cepillar los dientes despacio también es meditar. Dos minutos de atención plena.',
            'Cuida tu sonrisa con calma. Lo pequeño, hecho cada día, se vuelve salud.',
            'Un gesto sencillo y constante: el cepillo. Hazlo sin prisa, con presencia.',
          ],
          floss: [
            'Entre diente y diente, como entre respiración y respiración, hay un espacio que merece cuidado.',
            'El hilo dental es paciencia en movimiento. Pásalo con suavidad.',
            'Lo que no se ve también importa. Cuida tus encías con calma.',
          ],
          noFap: [
            'El deseo llega como una ola. Obsérvalo, respira, y deja que pase.',
            'Cada día que eliges con conciencia fortalece la mente. Sigue tu camino, sin prisa y sin culpa.',
            'Si la mente se agita, mueve el cuerpo: camina, respira, vuelve al presente.',
          ],
        },
        generic: [
          { text: 'Respira. Es el momento de «{habit}». Hazlo con calma, sin prisa.',
            voice: 'Respira. Es el momento de tu hábito. Hazlo con calma, sin prisa.' },
          { text: 'Cada día es una nueva oportunidad. Hoy, «{habit}» te espera.',
            voice: 'Cada día es una nueva oportunidad. Hoy, tu hábito te espera.' },
          { text: 'Un paso cada vez. El de ahora es «{habit}».',
            voice: 'Un paso cada vez. El de ahora es tu hábito pendiente.' },
          { text: 'La constancia es silenciosa. «{habit}», ahora, con presencia.',
            voice: 'La constancia es silenciosa. Tu hábito, ahora, con presencia.' },
        ],
        praise: [
          'Bien hecho. Así, paso a paso, crece el bambú.',
          'Has cumplido. Respira y disfruta este momento.',
          'Un paso más en el camino. Sigue así, con calma.',
          'La constancia florece. Bien hecho.',
          'Sonríe. Hoy has sido amable contigo.',
        ],
      },
      en: {
        name: 'Master Zen',
        tagline: 'Absolute calm. No hurry, and no pause.',
        intro: 'Breathe. I am Master Zen. I will walk with you through every habit, without hurry... but without pause.',
        habits: {
          meditate: [
            'Sit down. Close your eyes. Let your thoughts drift by, like clouds in the sky.',
            'Silence is not outside. It is within you. Sit, and listen to it.',
            'Breathe deeply. Let the air out slowly. This moment is all there is.',
          ],
          gratitude: [
            'Look around you, calmly. Three good things are waiting. Write them down.',
            'Whoever is grateful for small things receives great ones. Write down three gratitudes.',
            'The river does not ask for more water; it is grateful for what it has. Write down three good things.',
          ],
          journal: [
            'The mind is like a stirred-up river. Write, and the water will clear again.',
            'Written words are leaves the wind can no longer carry away. Write for a while.',
            'Write without judging. What leaves you no longer weighs on you.',
          ],
          selfcare: [
            'You also deserve your own care. Give yourself this moment, without guilt.',
            'A lamp without oil gives no light. Look after yourself, so you can shine.',
            'Pause. Do something kind for yourself. The world will keep turning.',
          ],
          walk: [
            'Walk slowly. Each step is a small meditation. The path is waiting for you.',
            'You do not need to arrive anywhere. It is enough to walk and be present.',
            'Feel the ground beneath your feet. Each step brings you back to now.',
          ],
          run: [
            'Run like the wind: fighting nothing. Your pace is the right pace.',
            'Run with your breath as your guide. The body knows the way.',
            'The mountain is never in a hurry, yet it touches the sky. Run in your own way.',
          ],
          strength: [
            'Bamboo is flexible and strong at once. Train your body with patience.',
            'True strength is born of steadiness. One more set, with attention.',
            'Every movement made with presence builds a calm and strong body.',
          ],
          bike: [
            'Ride without hurry. Let the scenery change, and your mind with it.',
            'The wheel turns, the wind passes, the mind grows still. Go for a ride.',
            'A path travelled in calm is worth more than many travelled in haste.',
          ],
          stretch: [
            'Stretch your body like a tree reaching for the light. Slowly. Without forcing.',
            'Listen to your body. Stretch as far as it goes today, and no further.',
            'Breathe into each stretch. Where the breath goes, calm follows.',
          ],
          water: [
            'Water gives life to the river, and to you. Drink a glass, calmly.',
            'Be like water: soft and steady. Now, drink a little.',
            'A sip of water, taken with attention, is also meditation.',
          ],
          fruit: [
            'Nature offers you its sweetness. Eat a piece of fruit, and savour it.',
            'Eat slowly. Each bite of fruit is a gift from the earth.',
            'The tree gives its fruit expecting nothing. Accept it with gratitude.',
          ],
          veggies: [
            'A plate with green is a garden that cares for you. Eat mindfully.',
            'What you eat becomes you. Choose vegetables; choose balance.',
            'Eat without hurry, and with colour. The body is grateful for simplicity.',
          ],
          vitamins: [
            'Small gestures, great changes. It is time for your vitamins.',
            'Daily care is like watering a plant. Take your vitamins.',
            'Simple things, done every day, become strength. Your vitamins are waiting.',
          ],
          skincare: [
            'Care for your skin as you would care for a garden: with patience and with love.',
            'Look at yourself kindly. Two minutes of care are an act of respect.',
            'Caring for your skin, calmly, is a small ritual of peace.',
          ],
          sunlight: [
            'The sun is never in a hurry, yet it lights everything. Go out and receive its light.',
            'Step outside for a moment. Let the light touch your face. Breathe.',
            'The flower seeks the sun without effort. Do as it does.',
          ],
          sleepEarly: [
            'Night comes so we can rest. Let the day go. It is time to sleep.',
            'As the sun sets without resistance, let your day end too.',
            'Rest. What you did not do today can wait until tomorrow.',
          ],
          noPhoneBed: [
            'Leave the phone far away. Your bed is a temple for rest.',
            'The light of the screen keeps sleep away. Switch it off, and let calm arrive.',
            'Before sleep, disconnect. Silence rests too.',
          ],
          nightRoutine: [
            'Lower the lights. Lower the pace. Prepare your mind for the calm of the night.',
            'The night is a still lake. Prepare to enter it, slowly.',
            'End the day with slow gestures. The calm of now is the rest of later.',
          ],
          read: [
            'A book is a journey made in silence. Read a few pages, without hurry.',
            'Read with full attention. Each word is a seed.',
            'Open your book as you would open a window. Let something new come in.',
          ],
          study: [
            'One task. One mind. Study now, with full attention.',
            'The steady drop wears away the stone. One block of study, today.',
            'Study without hurry and without distraction. Learning blossoms in calm.',
          ],
          planDay: [
            'Before you walk, look at the path. Take a few minutes to plan your day.',
            'An ordered mind makes a serene day. Choose your priorities.',
            'You do not need to do everything. Choose what is essential, and begin.',
          ],
          tidy: [
            'An ordered space invites a calm mind. Tidy a little, slowly.',
            'Ordering the outside orders the inside. Ten minutes, with attention.',
            'Return each thing to its place, as leaves return to the earth.',
          ],
          callSomeone: [
            'Our roots hold us up. Talk today with someone you love.',
            'A friendly voice is a shelter. Call someone you care about.',
            'Sharing a moment with someone dear feeds the soul. Write to them today.',
          ],
          brushTeeth: [
            'Brushing your teeth slowly is meditation too. Two minutes of full attention.',
            'Care for your smile calmly. Small things, done every day, become health.',
            'A simple, steady gesture: the brush. Do it without hurry, fully present.',
          ],
          floss: [
            'Between tooth and tooth, as between breath and breath, there is a space that deserves care.',
            'Flossing is patience in motion. Move it gently.',
            'What cannot be seen matters too. Care for your gums, calmly.',
          ],
          noFap: [
            'Desire arrives like a wave. Watch it, breathe, and let it pass.',
            'Each day you choose with awareness strengthens the mind. Keep to your path, without hurry and without guilt.',
            'If the mind is restless, move the body: walk, breathe, return to the present.',
          ],
        },
        generic: [
          { text: 'Breathe. It is time for “{habit}”. Do it calmly, without hurry.',
            voice: 'Breathe. It is time for your habit. Do it calmly, without hurry.' },
          { text: 'Each day is a new chance. Today, “{habit}” is waiting for you.',
            voice: 'Each day is a new chance. Today, your habit is waiting for you.' },
          { text: 'One step at a time. The step now is “{habit}”.',
            voice: 'One step at a time. The step now is the habit that is waiting.' },
          { text: 'Steadiness is quiet. “{habit}”, now, with presence.',
            voice: 'Steadiness is quiet. Your habit, now, with presence.' },
        ],
        praise: [
          'Well done. Step by step, the bamboo grows.',
          'You have done it. Breathe, and enjoy this moment.',
          'One more step along the path. Carry on, calmly.',
          'Steadiness blossoms. Well done.',
          'Smile. Today you were kind to yourself.',
        ],
      },
    },
  };

  /* Habits keep the translation key they were created from. Catalogue keys
     are "hb" plus the line key; the older presets are mapped by hand. */
  const PRESET_LINES = {
    presetMeditate: 'meditate', presetGratitude: 'gratitude', presetWalk: 'walk',
    presetGym: 'strength', presetWater: 'water', presetSleep: 'sleepEarly',
    presetRead: 'read', presetNoPhone: 'noPhoneBed',
  };

  /** The habit's own lines, or null when only generic ones fit. */
  function lineKeyFor(nameKey) {
    if (!nameKey) return null;
    if (PRESET_LINES[nameKey]) return PRESET_LINES[nameKey];
    if (nameKey.indexOf('hb') !== 0) return null;
    const key = nameKey.charAt(2).toLowerCase() + nameKey.slice(3);
    return LINES.narrator.es.habits[key] ? key : null;
  }

  const byId = (id) => CAST.find((c) => c.id === id) || null;
  const lines = (id, lang) => (LINES[id] && (LINES[id][lang] || LINES[id].es)) || null;

  /* Where each recording sits, relative to the page. One file per line:
     intro, h-<habit>-<n> for a habit's lines, g<n> for the generic ones and
     p<n> for the answers to "done". */
  const voicePath = (id, lang, clip) => 'voices/' + id + '/' + lang + '/' + clip + '.webm';
  const avatarPath = (id) => 'avatars/' + id + '.svg';

  /* Recordings were named h-<habit> while each habit had a single line. Chat
     history from then still points there; that line is now the first one. */
  const upgradeVoicePath = (path) =>
    typeof path === 'string' ? path.replace(/\/h-([A-Za-z]+)\.webm$/, '/h-$1-1.webm') : path;

  global.GLOW_CAST = {
    CAST: CAST,
    LINES: LINES,
    byId: byId,
    lines: lines,
    lineKeyFor: lineKeyFor,
    voicePath: voicePath,
    avatarPath: avatarPath,
    upgradeVoicePath: upgradeVoicePath,
  };
})(typeof window !== 'undefined' ? window : globalThis);
