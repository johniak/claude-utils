# Facts

- Aplikacja jest webowa i instalowalna jako PWA na telefonie.
- Dashboard działa w lokalnej sieci LAN i nie wymaga dostępu spoza sieci w MVP.
- Dashboard pokazuje wiele instancji Claude Code uruchomionych na różnych komputerach w tej samej sieci lokalnej.
- Każda instancja jest prezentowana jako kafelek z tytułem/nazwą sesji, hostem, aktualnym statusem, czasem ostatniej zmiany i ostatnią ważną wiadomością.
- MVP monitoruje istniejące sesje Claude Code bez wymagania uruchamiania ich przez osobny wrapper.
- Status sesji jest raportowany przez lokalnego agenta na każdym komputerze, który integruje się z hookami Claude Code tam, gdzie to możliwe.
- System potrafi pokazać, że sesja działa, czeka na akcję użytkownika, zakończyła etap albo zakończyła całość.
- System przechowuje i pokazuje końcową wiadomość lub ostatnią istotną wiadomość sesji, żeby było widać, co Claude Code zrobił albo czego potrzebuje dalej.
- PWA jest tylko do podglądu w MVP i nie pozwala wysyłać komend ani odpowiedzi do sesji Claude Code.
- Pierwszymi wspieranymi systemami hostów są macOS oraz Linux/WSL.
- Dashboard dostaje aktualizacje statusu w czasie rzeczywistym przez WebSocket albo SSE, bez natywnych powiadomień push w MVP.
- System zachowuje krótką historię ostatnich zdarzeń i zakończonych sesji.
- MVP nie wymaga logowania ani autoryzacji, bo działa wyłącznie w zaufanej sieci lokalnej.
- UI jest zoptymalizowany pod telefon: kafelki są czytelne na małym ekranie, a status wymagający uwagi jest widoczny od razu.
