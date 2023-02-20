# my ioBroker rest-api longpoll demo

Was ist [long polling](https://javascript.info/long-polling)?

Long Polling ist der einfachste Weg, um eine dauerhafte Verbindung zu einem Server herzustellen. Sobald der Server dem browser eine Nachricht sendet wird diese von browser sofort empfangen. Dadurch wird das Netz nur sehr wenig belastet und die Daten können ohne Verzögerung vom browser verarbeitet werden.


In diesem Projekt habe ich eine javascript Klasse entwickelt, mit deren Hilfe Daten aus dem iobroker gelesen, abonniert und verändern werden können. Zum Testen der Klasse habe ich eine html Seite erstellt, in der die Ergebnisse dargestellt werden, und in der die Methoden der Klasse verwendet werden.
Ich habe keinen besonderen Wert auf das Aussehen gelegt, da die html Seite nur zum Testen der javascript Klasse dienen soll.


## Voraussetzungen
- Installierte, aktuelle Version des [iobrokers](https://www.iobroker.net/)
- Im ioBroker muss der [rest-api Adapter](https://github.com/ioBroker/ioBroker.rest-api) installiert und konfiguriert sein.
  Der rest-api Adapter bietet die Möglichkeit Datenpunkte zu abonnieren und auf Veränderungen zu reagieren, sehr ähnlich wie beim MQTT Adapter.

  Bei Verwendung von MQTT in einer html Seite, besteht aber das Problem, dass beim Setzen eines Datenpunktes nicht das zugehörige Gerät reagiert. Mit einer rest-api gibt es dieses Problem nicht.


## Hinweis
Für den ioBroker gibt es auch einen Adapter mit dem Name ['*simple rest-api*'](https://github.com/ioBroker/ioBroker.simple-api). Dieser unterstützt aber kein [*long polling*](https://javascript.info/long-polling), was für das Abonnieren von Datenpunkten benötigt wird.
  Leider ist der rest-api Adapter noch in einer sehr frühen Version und vor drei Monaten (Stand Februar.2023) das letzte Mal bearbeitet worden.


## Meine Motivation
Unter den [Beispielen](https://github.com/ioBroker/ioBroker.rest-api/tree/master/examples) im github repository des rest-api Adapters ist auch eins für die Verwendung von *long polling* in einem [browser](https://github.com/ioBroker/ioBroker.rest-api/blob/master/examples/demoBrowserClient.html). Jedoch hatte ich einige Schwierigkeiten bei der Benutzung des [Beispiels](https://github.com/ioBroker/ioBroker.rest-api/blob/master/examples/longPolling.js).

### Meine Probleme mit dem Beispiel sind:
- meiner Meinung nach ist der code recht unübersichtlich und nur wenig kommentiert.
- es sind viele Variablen im Scriptteil der html Seite erforderlich.
- bei jedem Aufruf der Seite wird eine neue *session-id* generiert, was bei mir nach wenigen Malen dazu führte, das die Abonnenten keine Ereignisse mehr bei Änderungen sendeten.
- beim Abonnieren von Datenpunkten ist im script vorgesehen, das eine callback Funktion als zweiter Parameter angegeben werden kann. Dies wird im Beispiel aber nicht verwendet. Für mich war es auch wichtiger, dass ich zusätzliche Informationen mitgeben kann. Diese Information kann dann im Ereignis das bei Veränderungen ausgelöst wird verwendet werden.
- beim Abonnieren von Datenpunkten zu shelly Geräten wird die gesendete URL nicht ganz erkannt, da diese Datenpunkte '#'-Zeichen im Namen haben.
- die html Seite ist leer.

# Das Projekt

## Von mir benutzte Programme
- Visual Studio Code. Erweiterungen:
  - Live Server
  - weitere, die das Bearbeiten von html, css und js erleichtern
- Firefox (light mode)

## In meiner Version implementiert:
- eine einzige Klasse die nicht nur das *long polling* kapselt, sondern in der auch die anderen (im Moment nur die von mir benötigten) Aufrufe der rest-api enthalten sind.
- keine zusätzlichen Variablen außer der Instanz der rest-api Klasse und den Ereignis Funktionen im html Dokument nötig.
- beim Abonnieren kann ein zusätzliches Objekt mitgegeben werden, das im Ereignis gelesen werden kann.
- Abonnieren von Datenpunkten zu shelly Geräten ist möglich, da beim Senden in der URL alle '#'-Zeichen der id durch '%23' ersetzt werden.
- Die *session-id* wird im constructor gesetzt und bleibt so bei jedem Aufruf der html Seite gleich.

  Da ich mit vsCode und der 'Live Server' Erweiterung arbeite, lud die Erweiterung bei jedem Speichern die Seite im browser neu und damit wurde auch jedes Mal eine neue session-id generiert.

## Die html Seite zum Testen der javascript Klasse
Ich habe die html Seite relativ einfach gehalten.
Auf der html Seite sind nur Schalter für das Ein- und Ausschalten der *long polling* Funktion, sowie Anzeigefelder für die abonnierten Datenpunkten und ein Schalter zum setzen des Wertes einer der beiden Datenpunkte (ein boolean Wert) zu sehen. Zusätzlich wird die zuletzt empfangene Nachricht angezeigt.

Um das ganze einiger Maßen ansehnlich zu machen, habe ich einige CSS Stile hinzugefügt.

Den Skriptteil der html Seite kommentiere ich so, dass alles verständlich sein sollte.
Es werden zwei Datenpunkte abonniert, die (soweit ich weiß) im ioBroker standardmäßig vorhanden sind.
Die Abonnierten Datenpunkte können leicht angepasst werden. Unter Umständen muss dann aber auch im html etwas geändert werden, was aber mit ein wenig html Kenntnissen auch nicht so kompliziert sein sollte.
