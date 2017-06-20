const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Soup = imports.gi.Soup;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const Lang = imports.lang;
const Settings = imports.ui.settings;

const GLib = imports.gi.GLib;
const CMenu = imports.gi.CMenu;
const Pango = imports.gi.Pango;
const Main = imports.ui.main;

const _httpSession = new Soup.SessionAsync();

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

function PictureMenuItem(file) {
    this._init(file);
}

PictureMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(file, params) {
        try {
            PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
            let image = St.TextureCache.get_default().load_uri_async(file, 64, 64);
            this.addActor(image);
            let tooltip = new Tooltips.Tooltip(this.actor, fileInfo.get_name());

        } catch(e) {
            global.logError(e);
        }
    }
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.settings = new Settings.AppletSettings(this, "halo-stats@cluoma.com", instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, "api-key", "apiKey", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "gamertag", "gamertag", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "arena-playlist", "arenaPlaylist", null, null);

        this.set_applet_icon_name("icon-white");
        this.set_applet_tooltip(_("View your Halo 5 stats"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Build Menu
        let mainBox = new St.BoxLayout({ vertical: true });
        this.menu.addActor(mainBox);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addActor(new St.BoxLayout({ vertical: true }));

        // Arena Statistics
        this._arenaStats = new St.Bin();
        this._rankIconBox = new St.Bin();
        mainBox.add_actor(this._arenaStats);
        mainBox.add_actor(this._rankIconBox);

        ////////////////
        // Playlist data
        this._timePlayed = 0;
        // Games
        this._matchesRemaining = 0;
        this._totalGames = 0;
        this._totalGamesWon = 0;
        this._totalGamesLost = 0;
        this._totalGamesTied = 0;
        // CSR
        this._csrTier = 0;
        this._csrDesignation = 0;
        this._csrCsr = 0;
        this._csrPercToNextTier = 0;
        this._csrRank = 0;
        this._csrPercentile = 0;
        // Kills
        this._totalKills = 0;
        this._totalDeaths = 0;
        this._totalAssists = 0;
        // Accuraccy
        this._totalShots = 0;
        this._totalShotsLanded = 0;

    },

    loadJsonAsync: function loadJsonAsync(url, callback) {
        let context = this;
        let message = Soup.Message.new('GET', String("https://www.haloapi.com/stats/h5/servicerecords/arena?players=" + this.gamertag));
        message.request_headers.append("Ocp-Apim-Subscription-Key", this.apiKey);
        _httpSession.queue_message(message, function soupQueue(session, message) {
            callback.call(context, JSON.parse(message.response_body.data))
        });
    },

    loadRankIconJsonAsync: function loadRankIconJsonAsync(callback) {
        let context = this;
        let message = Soup.Message.new('GET', String("https://www.haloapi.com/metadata/h5/metadata/csr-designations/"));
        message.request_headers.append("Ocp-Apim-Subscription-Key", this.apiKey);
        _httpSession.queue_message(message, function soupQueue(session, message) {
            callback.call(context, JSON.parse(message.response_body.data))
        });
    },

    updateMenu: function() {
        this.menu.removeAll();

        this._timePlayed = 0;
        // Games
        this._matchesRemaining = 0;
        this._totalGames = 0;
        this._totalGamesWon = 0;
        this._totalGamesLost = 0;
        this._totalGamesTied = 0;
        // CSR
        this._csrTier = 0;
        this._csrDesignation = 0;
        this._csrCsr = 0;
        this._csrPercToNextTier = 0;
        this._csrRank = 0;
        this._csrPercentile = 0;
        // Kills
        this._totalKills = 0;
        this._totalDeaths = 0;
        this._totalAssists = 0;
        // Accuraccy
        this._totalShots = 0;
        this._totalShotsLanded = 0;

        this.loadJsonAsync("", function(json) {
            for (i = 0; i < json.Results[0].Result.ArenaStats.ArenaPlaylistStats.length; i++) {
                if (json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].PlaylistId == this.arenaPlaylist) {
                    // Games
                    this._totalGames = Number(json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].TotalGamesCompleted);
                    this._totalGamesWon = Number(json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].TotalGamesWon);
                    this._totalGamesLost = Number(json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].TotalGamesLost);
                    this._totalGamesTied = Number(json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].TotalGamesTied);

                    // CSR
                    if (json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].Csr) {
                        this._csrTier = json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].Csr.Tier;
                        this._csrDesignation = json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].Csr.DesignationId;
                        this._csrCsr = json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].Csr.Csr;;
                        this._csrPercToNextTier = json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].Csr.PercentToNextTier;
                        this._csrRank = json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].Csr.Rank;
                        this._csrPercentile = json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].CsrPercentile;

                        this.loadRankIconJsonAsync(function(json) {
                            this._rankIcon = St.TextureCache.get_default().load_uri_async(String(json[this._csrDesignation].tiers[this._csrTier-1].iconImageUrl), 200, 200);
                            rr.remove_all_children();
                            rr.add_actor(this._rankIcon);
                        });
                    } else {
                        this._matchesRemaining = json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].MeasurementMatchesLeft;

                        this.loadRankIconJsonAsync(function(json) {
                            this._rankIcon = St.TextureCache.get_default().load_uri_async(String(json[0].tiers[10-this._matchesRemaining].iconImageUrl), 200, 200);
                            rr.remove_all_children();
                            rr.add_actor(this._rankIcon);
                        });
                    }

                    // Kills
                    this._totalKills = Number(json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].TotalKills);
                    this._totalDeaths = Number(json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].TotalDeaths);
                    this._totalAssists = Number(json.Results[0].Result.ArenaStats.ArenaPlaylistStats[i].TotalAssists);

                }
            }
            // CSR
            this._csrSummary.text = String(this._csrDesignationName(this._csrDesignation) + " " + this._csrCorrectTier(this._csrDesignation, this._csrTier, this._matchesRemaining, this._csrCsr));
            if (parseInt(this._csrDesignation) == 7) {
                this._csrSummary.text = String(this._csrSummary.text + "  #" + this._csrRank);
            } else {
                this._csrSummary.text = String(this._csrSummary.text + "\n" + this._csrPercToNextTier + "% to next Tier");
            }
            this._csrSummary.text = String(this._csrSummary.text + "\nTop " + this._csrPercentile + "% of players\n");

            // // Games
            this._arenaStatsSummary.text = String("Matches\n");
            this._arenaStatsSummary.text = String(this._arenaStatsSummary.text + "Won: " + this._totalGamesWon + "  Lost: " + this._totalGamesLost + "  Tied: " + this._totalGamesTied);
            this._arenaStatsSummary.text = String(this._arenaStatsSummary.text + "\n" + Math.round(((this._totalGamesWon/this._totalGames)*100)*100)/100 + "% Winrate" + "\n\n");

            // Kills
            this._arenaStatsSummary.text = String(this._arenaStatsSummary.text + "Slaying\n");
            this._arenaStatsSummary.text = String(this._arenaStatsSummary.text + "Kills: " + this._totalKills + "  Deaths: " + this._totalDeaths + "  Assists: " + this._totalAssists);
            this._arenaStatsSummary.text = String(this._arenaStatsSummary.text + "\n" + "KDA Spread: " + Math.round(((this._totalKills - this._totalDeaths + (1/3)*this._totalAssists))*100)/100);
            this._arenaStatsSummary.text = String(this._arenaStatsSummary.text + "\n" + "KDA Ratio: " + Math.round(((this._totalKills + (1/3)*this._totalAssists) / this._totalDeaths)*100)/100);
        });

        this._arenaStatsSummary = new St.Label({
            text: _('Loading ...')
        });

        this._csrSummary = new St.Label({
            text: _('')
        })

        this._playerGamerTag = new St.Label({
            text: _(this.gamertag + "\n"),
            style: 'font-weight: bold; text-align: center; width: 100%;'
        })

        this._rankIcon = St.TextureCache.get_default().load_uri_async("https://content.halocdn.com/media/Default/games/halo-5-guardians/csr/unranked_00-61fca949c33f433ba7e7507d97ff130f.png", 200, 200);

        let bb = new St.BoxLayout({ vertical: true });
        bb.add_actor(this._playerGamerTag);
        bb.add_actor(this._csrSummary);
        bb.add_actor(this._arenaStatsSummary);

        //let box = new St.BoxLayout({ style: 'padding: 10px;' });
        let box = new St.BoxLayout({ style: 'padding: 10px;' });
        box.add_actor(bb);
        this._arenaStats.set_child(box);

        let rr = new St.BoxLayout();
        rr.add_actor(this._rankIcon);
        this._rankIconBox.set_child(rr);
    },

    _csrDesignationName: function _csrDesignationName(designation) {
        switch(parseInt(designation)) {
            case 0:
                return "Unranked";
            case 1:
                return "Bronze";
            case 2:
                return "Silver";
            case 3:
                return "Gold";
            case 4:
                return "Platinum";
            case 5:
                return "Diamond";
            case 6:
                return "Onyx";
            case 7:
                return "Champion";
            default:
                return "Unranked";
        }
    },

    _csrCorrectTier: function _csrCorrectTier(designation, tier, unfinished_matches, csr, rank) {
        if (parseInt(designation) == 6 || parseInt(designation) == 7) {
            return csr;
        } else if (parseInt(designation) == 0) {
            return 10 - parseInt(unfinished_matches);
        } else {
            return parseInt(tier);
        }
    },

    on_applet_clicked: function() {
        this.updateMenu();
        this.menu.toggle();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
            return new MyApplet(orientation, panel_height, instance_id);
}
