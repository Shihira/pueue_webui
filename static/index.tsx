import React from 'react';
import { createRoot } from 'react-dom/client';

import { pueueManager, establishWebsocket } from './pueue-manager';
import { PueueView } from './views/pueue-view';
import { views } from './views';


import "@patternfly/patternfly/patternfly";
import "@patternfly/patternfly/patternfly-theme-dark";
import "./styles";

document.addEventListener('DOMContentLoaded', async () => {
    await pueueManager.connect(establishWebsocket('ws://' + window.location.host));

    var e : HTMLElement | null = null;

    const viewsSorted = views.filter(Boolean);
    viewsSorted.sort((a, b) => a.priority - b.priority);

    e = document.getElementById('main-views');
    e && createRoot(e).render(
        <PueueView followGlobalDark={false}>
            {viewsSorted.map((x) => <>{x.view}<br/></>)}
        </PueueView>
    );
});
