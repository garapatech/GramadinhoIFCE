"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { applyAvatarPreviewIdlePose, buildAvatarPreviewRig, disposeAvatarPreviewRig } from "@/features/avatar/avatarPreviewRig";
import type { Avatar } from "@/features/avatar/avatarConfig";

type Avatar3DPreviewProps = {
  avatar: Avatar;
};

export default function Avatar3DPreview({ avatar }: Avatar3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef(avatar);

  // Keep the latest avatar accessible without rebuilding the scene on every render.
  avatarRef.current = avatar;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 240;
    const height = mount.clientHeight || 320;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(26, width / height, 0.1, 50);
    camera.position.set(0, 1.45, 7.2);
    camera.lookAt(0, 1.05, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xfff3d6, 0x6f9c7b, 0.85);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1cd, 1.0);
    key.position.set(2.5, 4, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd7ff, 0.45);
    rim.position.set(-3, 2.5, -2.5);
    scene.add(rim);

    const shadowTex = (() => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return new THREE.CanvasTexture(canvas);
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(0,0,0,0.45)");
      gradient.addColorStop(0.6, "rgba(0,0,0,0.12)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(canvas);
    })();
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 1.1),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    scene.add(shadow);

    const rig = buildAvatarPreviewRig(avatarRef.current);
    scene.add(rig.group);

    const state = {
      scene,
      camera,
      renderer,
      mount,
      rig,
      lastAvatarKey: JSON.stringify(avatarRef.current),
      stopped: false,
      startTime: performance.now(),
      raf: 0,
    };

    function rebuildIfChanged() {
      const key = JSON.stringify(avatarRef.current);
      if (key === state.lastAvatarKey) return;
      state.lastAvatarKey = key;
      const oldRig = state.rig;
      scene.remove(oldRig.group);
      disposeAvatarPreviewRig(oldRig);
      const newRig = buildAvatarPreviewRig(avatarRef.current);
      scene.add(newRig.group);
      state.rig = newRig;
    }

    function onResize() {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    function tick() {
      if (state.stopped) return;
      rebuildIfChanged();
      const t = (performance.now() - state.startTime) / 1000;
      state.rig.group.rotation.y = Math.sin(t * 0.55) * 0.7;
      applyAvatarPreviewIdlePose(state.rig.refs, t);
      renderer.render(scene, camera);
      state.raf = requestAnimationFrame(tick);
    }

    state.raf = requestAnimationFrame(tick);

    return () => {
      state.stopped = true;
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      disposeAvatarPreviewRig(state.rig);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="avatar-3d-stage" aria-hidden="true" />;
}
