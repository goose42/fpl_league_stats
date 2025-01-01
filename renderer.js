const axios = require('axios');

class FPLLeague {
    constructor() {
        this.BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
        this.LEAGUE_URL_TEMPLATE = "https://fantasy.premierleague.com/api/leagues-classic/{}/standings/";
        this.PICKS_URL_TEMPLATE = "https://fantasy.premierleague.com/api/entry/{}/event/{}/picks/";
        this.TRANSFERS_URL_TEMPLATE = "https://fantasy.premierleague.com/api/entry/{}/transfers/";
        this.PLAYER_URL_TEMPLATE = "https://fantasy.premierleague.com/api/element-summary/{}/";
        // Add league history
        this.leagueHistory = this.loadLeagueHistory();
        
        // Add bootstrap data cache
        this.bootstrapData = null;
        this.playerMap = null;
        this.gameweek = null;
        
        this.setupLeagueInput();
        this.displayLeagueHistory();
        this.setupPlayerModal();
    }

    loadLeagueHistory() {
        const history = localStorage.getItem('leagueHistory');
        return history ? JSON.parse(history) : [];
    }

    saveLeagueHistory() {
        // Keep only the last 5 leagues
        this.leagueHistory = this.leagueHistory.slice(0, 5);
        localStorage.setItem('leagueHistory', JSON.stringify(this.leagueHistory));
    }

    addToHistory(leagueId, leagueName) {
        // Remove if already exists
        this.leagueHistory = this.leagueHistory.filter(l => l.id !== leagueId);
        // Add to beginning of array
        this.leagueHistory.unshift({
            id: leagueId,
            name: leagueName,
            lastAccessed: new Date().toISOString()
        });
        this.saveLeagueHistory();
    }

    displayLeagueHistory() {
        const historyList = document.getElementById('league-history-list');
        historyList.innerHTML = '';

        if (this.leagueHistory.length === 0) {
            historyList.innerHTML = '<div class="no-history">No recent leagues</div>';
            return;
        }

        this.leagueHistory.forEach(league => {
            const item = document.createElement('div');
            item.className = 'league-history-item';
            item.innerHTML = `
                <div class="league-info">
                    <span class="league-id">${league.id}</span>
                    <span class="league-name">${league.name}</span>
                </div>
                <button class="delete-league" title="Remove from history">×</button>
            `;
            
            // Add click handler for the league info
            const leagueInfo = item.querySelector('.league-info');
            leagueInfo.addEventListener('click', () => this.loadLeagueFromHistory(league.id));
            
            // Add click handler for delete button
            const deleteBtn = item.querySelector('.delete-league');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering the league load
                this.removeFromHistory(league.id);
            });
            
            historyList.appendChild(item);
        });
    }

    async loadLeagueFromHistory(leagueId) {
        const leagueInput = document.getElementById('league-id');
        leagueInput.value = leagueId;
        await this.handleLeagueSubmit();
    }

    setupLeagueInput() {
        const submitButton = document.getElementById('submit-league');
        const leagueInput = document.getElementById('league-id');
        const changeLeagueBtn = document.getElementById('change-league-btn');

        submitButton.addEventListener('click', () => this.handleLeagueSubmit());
        leagueInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLeagueSubmit();
            }
        });

        // Add change league button handler
        if (changeLeagueBtn) {
            changeLeagueBtn.addEventListener('click', () => this.handleChangeLeague());
        }
    }

    handleChangeLeague() {
        this.resetAppState();
        
        // Show input container and hide main content
        document.getElementById('league-input-container').style.display = 'block';
        document.getElementById('main-content').style.display = 'none';
        
        // Reset and enable the input field
        const leagueInput = document.getElementById('league-id');
        const submitButton = document.getElementById('submit-league');
        leagueInput.value = '';
        leagueInput.disabled = false;
        submitButton.disabled = false;

        // Refresh league history display
        this.displayLeagueHistory();
    }

    resetAppState() {
        // Update existing resetAppState method
        ['standings-table', 'ownership-table', 'captains-table', 
         'transfers-in-table', 'transfers-out-table', 
         'team-picks-table', 'team-transfers-table'].forEach(tableId => {
            const table = document.getElementById(tableId);
            if (table) {
                table.innerHTML = '';
            }
        });

        // Reset status bar
        if (this.statusBar) {
            this.statusBar.textContent = '';
            this.statusBar.classList.remove('active');
        }

        // Reset views
        document.getElementById('team-view').style.display = 'none';
        document.getElementById('league-view').style.display = 'block';
    }

    async handleLeagueSubmit() {
        const leagueInput = document.getElementById('league-id');
        const submitButton = document.getElementById('submit-league');
        const leagueId = leagueInput.value.trim();

        // Validate input
        if (!leagueId) {
            this.showError('Please enter a league ID');
            return;
        }

        if (!Number.isInteger(Number(leagueId)) || Number(leagueId) <= 0) {
            this.showError('Please enter a valid league ID (positive integer)');
            return;
        }

        // Disable input during loading
        leagueInput.disabled = true;
        submitButton.disabled = true;

        try {
            // Test if league exists
            const testResponse = await axios.get(this.LEAGUE_URL_TEMPLATE.replace('{}', leagueId));
            
            // Get league name from response
            const leagueName = testResponse.data.league.name;
            
            // Add to history
            this.addToHistory(leagueId, leagueName);
            
            // If we get here, league exists
            this.LEAGUE_URL = this.LEAGUE_URL_TEMPLATE.replace('{}', leagueId);
            
            // Update league ID display
            document.getElementById('league-id-display').textContent = `${leagueName} (ID: ${leagueId})`;
            
            // Hide input container and show main content
            document.getElementById('league-input-container').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            
            // Initialize the rest of the app
            this.setupReloadButton();
            this.statusBar = document.getElementById('status-bar');
            await this.init();

        } catch (error) {
            this.showError('League not found or error occurred');
            leagueInput.disabled = false;
            submitButton.disabled = false;
        }
    }

    showError(message) {
        // You could implement this in various ways - for now just alert
        alert(message);
    }

    setupReloadButton() {
        const reloadBtn = document.getElementById('reload-btn');
        reloadBtn.addEventListener('click', async () => {
            await this.reloadData();
        });
    }

    async reloadData() {
        const reloadBtn = document.getElementById('reload-btn');
        reloadBtn.disabled = true;
        this.showStatus('Reloading data...');

        try {
            // Reset bootstrap data to force a fresh load
            this.bootstrapData = null;
            this.playerMap = null;
            this.gameweek = null;

            const bootstrapSuccess = await this.loadBootstrapData();
            if (!bootstrapSuccess) {
                throw new Error('Failed to load game data');
            }

            await this.fetchLeagueStandings();
            this.showStatus('Data successfully reloaded!', 3000);
        } catch (error) {
            this.showStatus('Error reloading data. Please try again.', 3000);
            console.error('Reload error:', error);
        } finally {
            reloadBtn.disabled = false;
        }
    }

    showStatus(message, timeout = 0) {
        this.statusBar.textContent = message;
        this.statusBar.classList.add('active');

        if (timeout > 0) {
            setTimeout(() => {
                this.statusBar.classList.remove('active');
            }, timeout);
        }
    }

    async init() {
        this.showStatus('Initializing...');
        try {
            // Load bootstrap data first
            this.showStatus('Loading game data...');
            const bootstrapSuccess = await this.loadBootstrapData();
            if (!bootstrapSuccess) {
                throw new Error('Failed to load game data');
            }

            this.showStatus('Fetching league standings...');
            await this.fetchLeagueStandings();
            this.showStatus('Data loaded successfully!', 3000);
        } catch (error) {
            this.showStatus('Error loading data. Please try again.', 3000);
            console.error('Initialization error:', error);
        }
    }

    async loadBootstrapData() {
        if (!this.bootstrapData) {
            try {
                const response = await axios.get(this.BOOTSTRAP_URL);
                this.bootstrapData = response.data;
                
                // Create player map
                this.playerMap = this.bootstrapData.elements.reduce((map, p) => {
                    map[p.id] = p.web_name;
                    return map;
                }, {});

                // Get current gameweek
                const currentGw = this.bootstrapData.events.find(gw => gw.is_current);
                this.gameweek = currentGw ? currentGw.id : null;

                return true;
            } catch (error) {
                console.error('Error fetching bootstrap data:', error);
                return false;
            }
        }
        return true;
    }

    async getTeamPicks(teamId) {
        if (!this.gameweek || !this.playerMap) {
            await this.loadBootstrapData();
        }

        try {
            const picksUrl = this.PICKS_URL_TEMPLATE.replace('{}', teamId).replace('{}', this.gameweek);
            const transfersUrl = this.TRANSFERS_URL_TEMPLATE.replace('{}', teamId);

            const [picksResponse, transfersResponse] = await Promise.all([
                axios.get(picksUrl),
                axios.get(transfersUrl)
            ]);

            const picks = picksResponse.data.picks.map(pick => ({
                position: pick.position,
                player: this.playerMap[pick.element] || 'Unknown',
                isCaptain: pick.is_captain,
                isViceCaptain: pick.is_vice_captain,
                element: pick.element
            }));

            const transfers = transfersResponse.data
                .filter(t => t.event === this.gameweek)
                .map(transfer => ({
                    playerOut: this.playerMap[transfer.element_out] || 'Unknown',
                    playerIn: this.playerMap[transfer.element_in] || 'Unknown',
                    elementIn: transfer.element_in,
                    elementOut: transfer.element_out
                }));

            return { picks, transfers };
        } catch (error) {
            console.error('Error fetching team data:', error);
            return null;
        }
    }

    async fetchLeagueStandings() {
        try {
            const response = await axios.get(this.LEAGUE_URL);
            const standings = response.data.standings.results;

            const table = new Tabulator("#standings-table", {
                data: standings,
                layout: "fitColumns",
                columns: [
                    { title: "Rank", field: "rank" },
                    { title: "Team Name", field: "entry_name" },
                    { title: "Manager", field: "player_name" },
                    { title: "Total Points", field: "total" }
                ]
            });

            // Add row click event after table is initialized
            table.on("rowClick", (e, row) => {
                this.showTeamDetails(row.getData());
            });

            this.showStatus('Fetching league player picks...');
            const stats = await this.collectLeagueStats(standings);
            this.displayStats(stats);

        } catch (error) {
            console.error('Error fetching league data:', error);
        }
    }

    async showTeamDetails(teamData) {
        try {
            this.showStatus('Loading team details...');
            
            // Hide league view and show team view
            const leagueView = document.getElementById('league-view');
            const teamView = document.getElementById('team-view');
            
            leagueView.style.display = 'none';
            teamView.style.display = 'block';
            
            // Update team header
            document.getElementById('team-name').textContent = teamData.entry_name;
            document.getElementById('manager-name').textContent = `Manager: ${teamData.player_name}`;
            
            // Get team picks and league ownership data
            const [teamDetails, leagueStats] = await Promise.all([
                this.getTeamPicks(teamData.entry),
                this.getLeagueOwnershipStats()
            ]);
            
            if (!teamDetails) {
                throw new Error('Failed to load team details');
            }

            // Add ownership percentage to each pick
            const picksWithOwnership = teamDetails.picks.map(pick => ({
                ...pick,
                ownership: leagueStats.playerCounts[pick.player] || '0',
                element: pick.element
            }));

            // Display picks with ownership
            const picksTable = new Tabulator("#team-picks-table", {
                data: picksWithOwnership,
                layout: "fitColumns",
                columns: [
                    { title: "Position", field: "position" },
                    { title: "Player", field: "player" },
                    { 
                        title: "Role", 
                        field: "role",
                        formatter: (cell) => {
                            const data = cell.getRow().getData();
                            if (data.isCaptain) return "Captain";
                            if (data.isViceCaptain) return "Vice Captain";
                            return "";
                        }
                    },
                    { title: "League Ownership", field: "ownership" }
                ]
            });

            // Add row click event after table is initialized
            picksTable.on("rowClick", (e, row) => {
                const rowData = row.getData();
                if (!rowData.element) {
                    console.error('No element ID found for player:', rowData.player);
                    return;
                }
                this.showPlayerDetails(rowData);
            });

            // Display transfers if any
            if (teamDetails.transfers.length > 0) {
                new Tabulator("#team-transfers-table", {
                    data: teamDetails.transfers,
                    layout: "fitColumns",
                    columns: [
                        { title: "Player Out", field: "playerOut" },
                        { title: "Player In", field: "playerIn" }
                    ]
                });
            }

            // Setup back button
            const backButton = document.getElementById('back-to-league');
            backButton.onclick = () => this.showLeagueView();

            this.showStatus('Team details loaded', 3000);
        } catch (error) {
            console.error('Error showing team details:', error);
            this.showStatus('Error loading team details', 3000);
        }
    }

    showLeagueView() {
        document.getElementById('team-view').style.display = 'none';
        document.getElementById('league-view').style.display = 'block';
    }

    async collectLeagueStats(standings) {
        const playerCounts = {};
        const captainCounts = {};
        const viceCaptainCounts = {};
        const transfersInCounts = {};
        const transfersOutCounts = {};
        const totalTeams = standings.length;

        for (let i = 0; i < standings.length; i++) {
            const entry = standings[i];
            // Update status with progress
            this.showStatus(`Fetching team data (${i + 1}/${totalTeams})...`);
            
            const teamData = await this.getTeamPicks(entry.entry);
            if (!teamData) continue;

            // Process picks and transfers as before...
            teamData.picks.forEach(pick => {
                const playerName = pick.player;
                playerCounts[playerName] = (playerCounts[playerName] || 0) + 1;
                
                if (pick.isCaptain) {
                    captainCounts[playerName] = (captainCounts[playerName] || 0) + 1;
                }
                if (pick.isViceCaptain) {
                    viceCaptainCounts[playerName] = (viceCaptainCounts[playerName] || 0) + 1;
                }
            });

            teamData.transfers.forEach(transfer => {
                transfersInCounts[transfer.playerIn] = (transfersInCounts[transfer.playerIn] || 0) + 1;
                transfersOutCounts[transfer.playerOut] = (transfersOutCounts[transfer.playerOut] || 0) + 1;
            });
        }

        return {
            playerCounts,
            captainCounts,
            viceCaptainCounts,
            transfersInCounts,
            transfersOutCounts,
            totalTeams
        };
    }

    displayStats(stats) {
        // Display ownership stats
        const ownershipTable = new Tabulator("#ownership-table", {
            data: Object.entries(stats.playerCounts).map(([player, count]) => ({
                player,
                percentage: ((count / stats.totalTeams) * 100).toFixed(1) + '%',
                element: this.getPlayerElementId(player)
            })),
            layout: "fitColumns",
            headerSort: true,
            title: "Player Ownership",
            initialSort: [{column: "percentage", dir: "desc"}],
            columns: [
                { title: "Player", field: "player", sorter: "string" },
                { title: "Ownership %", field: "percentage", sorter: "number" }
            ]
        });

        ownershipTable.on("rowClick", (e, row) => {
            const rowData = row.getData();
            if (!rowData.element) {
                console.error('No element ID found for player:', rowData.player);
                return;
            }
            this.showPlayerDetails(rowData);
        });

        // Display captain stats
        const captainsTable = new Tabulator("#captains-table", {
            data: Object.entries(stats.captainCounts).map(([player, count]) => ({
                player,
                percentage: ((count / stats.totalTeams) * 100).toFixed(1) + '%',
                element: this.getPlayerElementId(player)
            })),
            layout: "fitColumns",
            headerSort: true,
            title: "Captain Choices",
            initialSort: [{column: "percentage", dir: "desc"}],
            columns: [
                { title: "Player", field: "player", sorter: "string" },
                { title: "Times Captained %", field: "percentage", sorter: "number" }
            ]
        });

        captainsTable.on("rowClick", (e, row) => {
            const rowData = row.getData();
            if (!rowData.element) {
                console.error('No element ID found for player:', rowData.player);
                return;
            }
            this.showPlayerDetails(rowData);
        });

        // Display transfers in table
        const transfersInData = Object.entries(stats.transfersInCounts).map(([player, count]) => ({
            player,
            count
        }));

        const transfersInTable = new Tabulator("#transfers-in-table", {
            data: transfersInData.map(data => ({
                ...data,
                element: this.getPlayerElementId(data.player)
            })),
            layout: "fitColumns", 
            headerSort: true,
            title: "Transfers In",
            initialSort: [{column: "count", dir: "desc"}],
            columns: [
                { title: "Player", field: "player", sorter: "string" },
                { title: "Transfers In", field: "count", sorter: "number" }
            ]
        });

        transfersInTable.on("rowClick", (e, row) => {
            const rowData = row.getData();
            if (!rowData.element) {
                console.error('No element ID found for player:', rowData.player);
                return;
            }
            this.showPlayerDetails(rowData);
        });

        // Display transfers out table
        const transfersOutData = Object.entries(stats.transfersOutCounts).map(([player, count]) => ({
            player,
            count
        }));

        const transfersOutTable = new Tabulator("#transfers-out-table", {
            data: transfersOutData.map(data => ({
                ...data,
                element: this.getPlayerElementId(data.player)
            })),
            layout: "fitColumns",
            headerSort: true, 
            title: "Transfers Out",
            initialSort: [{column: "count", dir: "desc"}],
            columns: [
                { title: "Player", field: "player", sorter: "string" },
                { title: "Transfers Out", field: "count", sorter: "number" }
            ]
        });

        transfersOutTable.on("rowClick", (e, row) => {
            const rowData = row.getData();
            if (!rowData.element) {
                console.error('No element ID found for player:', rowData.player);
                return;
            }
            this.showPlayerDetails(rowData);
        });
    }

    removeFromHistory(leagueId) {
        this.leagueHistory = this.leagueHistory.filter(l => l.id !== leagueId);
        this.saveLeagueHistory();
        this.displayLeagueHistory();
    }

    async getLeagueOwnershipStats() {
        try {
            const response = await axios.get(this.LEAGUE_URL);
            const standings = response.data.standings.results;
            
            const playerCounts = {};
            let totalTeams = standings.length;

            for (const entry of standings) {
                const teamData = await this.getTeamPicks(entry.entry);
                if (!teamData) continue;

                teamData.picks.forEach(pick => {
                    const playerName = pick.player;
                    playerCounts[playerName] = (playerCounts[playerName] || 0) + 1;
                });
            }

            return {
                playerCounts,
                totalTeams
            };
        } catch (error) {
            console.error('Error getting league ownership stats:', error);
            return { playerCounts: {}, totalTeams: 0 };
        }
    }

    setupPlayerModal() {
        const modal = document.getElementById('player-modal');
        const closeBtn = modal.querySelector('.close-modal');
        
        closeBtn.onclick = () => {
            modal.style.display = "none";
        };
        
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = "none";
            }
        };
    }

    async showPlayerDetails(playerData) {
        const modal = document.getElementById('player-modal');
        const playerName = document.getElementById('modal-player-name');
        
        modal.style.display = "block";
        playerName.textContent = playerData.player;
        
        this.showStatus('Loading player details...');
        
        try {
            const [fixtures, owners] = await Promise.all([
                this.getPlayerFixtures(playerData.element),
                this.getPlayerOwners(playerData.player)
            ]);
            
            // Show fixtures
            new Tabulator("#player-fixtures-table", {
                data: fixtures,
                layout: "fitColumns",
                columns: [
                    { 
                        title: "GW", 
                        field: "event" 
                    },
                    { 
                        title: "Fixture", 
                        field: "fixture",
                        formatter: (cell) => {
                            const data = cell.getRow().getData();
                            return data.isHome ? 
                                `${data.team} vs ${data.opponent}` :
                                `${data.opponent} vs ${data.team}`;
                        }
                    },
                    { 
                        title: "Difficulty", 
                        field: "difficulty",
                        formatter: (cell) => {
                            const diff = cell.getValue();
                            return `<span class="difficulty-${diff}">${diff}</span>`;
                        }
                    }
                ]
            });
            
            // Show owners
            new Tabulator("#player-owners-table", {
                data: owners,
                layout: "fitColumns",
                columns: [
                    { title: "Position", field: "rank" },
                    { title: "Team", field: "entry_name" },
                    { title: "Manager", field: "player_name" }
                ]
            });
            
            this.showStatus('Player details loaded', 3000);
        } catch (error) {
            console.error('Error loading player details:', error);
            this.showStatus('Error loading player details', 3000);
        }
    }

    async getPlayerFixtures(playerId) {
        try {
            // Fetch fixtures directly from player endpoint
            const response = await axios.get(this.PLAYER_URL_TEMPLATE.replace('{}', playerId));
            const playerData = response.data;
            
            if (!playerData.fixtures || !playerData.fixtures.length) {
                console.error('No fixtures found for player:', playerId);
                return [];
            }

            const fixtures = playerData.fixtures
                .filter(f => f.event) // Filter out fixtures without gameweek
                .slice(0, 5)  // Next 5 fixtures
                .map(fixture => {
                    const isHome = fixture.is_home;
                    const team = this.bootstrapData.teams.find(t => t.id === (isHome ? fixture.team_h : fixture.team_a));
                    const opponent = this.bootstrapData.teams.find(t => t.id === (isHome ? fixture.team_a : fixture.team_h));

                    return {
                        event: fixture.event,
                        team: team?.short_name || 'Unknown',
                        opponent: opponent?.short_name || 'Unknown',
                        isHome: fixture.is_home,
                        difficulty: fixture.difficulty
                    };
                });

            return fixtures;

        } catch (error) {
            console.error('Error fetching player fixtures:', error);
            return [];
        }
    }

    async getPlayerOwners(playerName) {
        try {
            const response = await axios.get(this.LEAGUE_URL);
            const standings = response.data.standings.results;
            const owners = [];
            
            for (const entry of standings) {
                const teamData = await this.getTeamPicks(entry.entry);
                if (!teamData) continue;
                
                if (teamData.picks.some(pick => pick.player === playerName)) {
                    owners.push({
                        rank: entry.rank,
                        entry_name: entry.entry_name,
                        player_name: entry.player_name
                    });
                }
            }
            
            return owners;
        } catch (error) {
            console.error('Error getting player owners:', error);
            return [];
        }
    }

    // Add this helper method to get player element ID
    getPlayerElementId(playerName) {
        if (!this.bootstrapData) return null;
        const player = this.bootstrapData.elements.find(p => p.web_name === playerName);
        return player ? player.id : null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FPLLeague();
});

// Add event listener for the clear history button
document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    const confirmation = confirm('Are you sure you want to clear all league history?');
    
    if (confirmation) {
        // Clear localStorage
        localStorage.removeItem('leagues');
        
        // Reset the leagues array
        leagues = [];
        
        // Clear the table
        if (leagueTable) {
            leagueTable.clearData();
        }
        
        // Clear the league container
        const leagueContainer = document.getElementById('leagueContainer');
        if (leagueContainer) {
            leagueContainer.innerHTML = '';
        }

        // If you have a league select dropdown, clear it too
        const leagueSelect = document.getElementById('leagueSelect');
        if (leagueSelect) {
            leagueSelect.innerHTML = '<option value="">Select a league</option>';
        }

        // Force a page refresh to ensure everything is reset
        location.reload();
    }
}); 