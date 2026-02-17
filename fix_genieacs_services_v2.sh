#!/bin/bash

# Function to update service file
update_service() {
    NAME=$1
    echo "Updating $NAME..."
    
    # Define specific environments for each service
    EXTRA_ENV=""
    if [ "$NAME" == "genieacs-ui" ]; then
        EXTRA_ENV="Environment=GENIEACS_UI_JWT_SECRET=billing_app_secret_key_2026_secured"
    fi

    cat <<EOF > /etc/systemd/system/$NAME.service
[Unit]
Description=$NAME
After=network.target

[Service]
User=adi
ExecStart=/usr/bin/$NAME
Restart=always
RestartSec=5s
Environment=GENIEACS_CWMP_ACCESS_LOG_FILE=/var/log/genieacs/$NAME-access.log
Environment=GENIEACS_NBI_ACCESS_LOG_FILE=/var/log/genieacs/$NAME-access.log
Environment=GENIEACS_FS_ACCESS_LOG_FILE=/var/log/genieacs/$NAME-access.log
Environment=GENIEACS_UI_ACCESS_LOG_FILE=/var/log/genieacs/$NAME-access.log
Environment=GENIEACS_DEBUG_FILE=/var/log/genieacs/$NAME-debug.yaml
Environment=NODE_ENV=production
$EXTRA_ENV

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable $NAME
    systemctl restart $NAME
    echo "$NAME updated and restarted."
}

# Ensure log directory exists and has permissions
mkdir -p /var/log/genieacs
chown -R adi:adi /var/log/genieacs

# Update all services
update_service "genieacs-cwmp"
update_service "genieacs-nbi"
update_service "genieacs-fs"
update_service "genieacs-ui"

echo "All GenieACS services updated with JWT Secret."
