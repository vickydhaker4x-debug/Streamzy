package com.vdmusic.player;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAudioPlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
