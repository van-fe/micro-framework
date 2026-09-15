import BpmnViewer from "bpmn-js/lib/Viewer";
import "bpmn-js/dist/assets/diagram-js.css";
import Vue from "vue2";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://example.test/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Start"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="Task_1" name="Review request"><bpmn:incoming>Flow_1</bpmn:incoming></bpmn:task>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
    <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="100" y="120" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="240" y="98" width="140" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="136" y="138"/><di:waypoint x="240" y="138"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export async function render(container: HTMLElement): Promise<() => void> {
  let viewer: BpmnViewer | undefined;
  let ready!: () => void;
  let failed!: (error: Error) => void;
  const loaded = new Promise<void>((resolve, reject) => { ready = resolve; failed = reject; });
  const vm = new Vue({
    render(h) {
      return h("section", [h("h2", "Vue 2 + BPMN Viewer"), h("div", { ref: "canvas", class: "upstream-bpmn-canvas" })]);
    },
    mounted() {
      viewer = new BpmnViewer({ container: this.$refs.canvas as HTMLElement });
      viewer.importXML(xml, (error) => {
        if (error) { failed(error); return; }
        const registry = viewer!.get<{ getAll(): unknown[] }>("elementRegistry");
        container.dataset.bpmnElements = String(registry.getAll().length);
        ready();
      });
    },
  });
  vm.$mount();
  container.append(vm.$el);
  try { await loaded; }
  catch (error) { viewer?.destroy(); vm.$destroy(); throw error; }
  return () => { viewer?.destroy(); vm.$destroy(); vm.$el.remove(); };
}
