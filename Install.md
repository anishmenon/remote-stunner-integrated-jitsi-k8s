# Installation

```
                         K8s cluster
                         +-----------------------------------------------------------------------------------+
                         |                                                                                   |
                    +---------+                   +-----+               +---------+                          |
      (init call)   |         |                   |     |    (XML)      |         |                          |
User -------------> | Ingress |-----------------> | Web |<------------> | Prosody |<-- +                     |
     \              |         |                   |     |             ->|         |    |                     |
      \             +---------+                   +-----+           /   +---------+    |                     |
       \ (TURN)          |                                        /                    | (Setup connection)  |
        \           +---------+                   +-----+       /       +--------+     |                     |
         \          |         |      (UDP)        |     |<------        |        |     |                     |
          +-------> | STUNner |-----------------> | JVB |-------------> | Jicofo |-----+                     |
         (TLS 443)  |         |                   |     |               |        |                           |
                    +---------+                   +-----+               +--------+                           |
                         |                                                                                   |
                         +-----------------------------------------------------------------------------------+
```

## Table of Content

1. Create a Digitalocean Kubernetes cluster
2. Creating the certificate secret
3. Install and configure the Nginx Ingress
4. Install and configure STUNner
5. Install and configure Jitsi
6. Scaling

## Create a Digitalocean Kubernetes cluster

On the [Digitalocean](https://cloud.digitalocean.com/kubernetes/) website create an autoscale Kubernetes cluster. After that connect to the cluster with the commands what the Digitalocean gives to you.

## Creating the certificate secret

### Prerequisites

- A valid certificate to your domains

### Creating the secret

Because both STUNner and Jitsi uses the same certificate it is required to create this secret in the default namespace where the Jitsi deployment will be located and in the stunner namespace where the stunner will located.

```console
kubectl create secret tls nexhe-ssl --cert=certificate.crt --key=private.key
kubectl create namespace stunner
kubectl create secret tls nexhe-ssl --cert=certificate.crt --key=private.key -n stunner
```

Verify that your secret exists:

```console
kubectl get secret
kubectl get secret -n stunner
```

You should see `nexhe-ssl` in both output.

## Install and configure the Nginx Ingress

### Prerequisites

- Helm3

### Installation

```console
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx
```

Wait until Kubernetes assigns an external IP to the Ingress. You can use the command below if you don't want to refresh all the time:

```console
until [ -n "$(kubectl get service ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')" ]; do sleep 1; done
```

With this command you can retrieve the IP of the Ingress load balancer:

```console
kubectl get service ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

### Configuration

Open this [file](/configs/ingress/ingress.yaml).

Read the comments carefully and change it according to your needs. After that apply it:

```console
kubectl apply -f /configs/ingress/ingress.yaml
```

After that add a record to your domain that points to the Ingress' load balancer IP.

## Install and configure STUNner

### Prerequisites

- Helm3

### Installation

```console
helm repo add stunner https://l7mp.io/stunner
helm repo update
helm install stunner-gateway-operator stunner/stunner-gateway-operator --create-namespace --namespace=stunner-system
helm install stunner stunner/stunner --create-namespace --namespace=stunner
```

### Configuration

Open this [file](/configs/stunner/gateway.yaml).

Read the comments carefully and change it according to your needs. After that apply it:

```
kubectl apply -f /configs/stunner/gateway.yaml
```

Wait until STUNner gets a load balancer IP:

```console
until [ -n "$(kubectl get svc stunner-gateway-udp-gateway-svc -n stunner -o jsonpath='{.status.loadBalancer.ingress[0].ip}')" ]; do sleep 1; done
```

After that add a record to your domain that points to the STUNer's load balancer IP.

## Install and configure Jitsi

Jitsi uses internal users to secure communication between it's components. These users are described in this [file](/configs/jitsi/secrets.yaml). It is highly recommended to change these in a production environment.

Also, Jitsi is being configured through [configmaps](configs/jitsi/configmaps.yaml). Open this file and read the comments carefully and change it accordingly.

The Jitsi deployments are located in this [file](/configs/jitsi/components.yaml). For now you have nothing to do with it.

```console
kubectl apply -f /configs/jitsi/secrets.yaml
kubectl apply -f /configs/jitsi/configmaps.yaml
kubectl apply -f /configs/jitsi/components.yaml
```

Wait until every pods are in running state. After that you can access the website on the domain what is pointing to your Ingress Gateway.

## Scaling

To scale resources you have to define resource limits in your deployments. For example the JVB deployment has these limits:

```yaml
resources:
  limits:
    cpu: 1000m
    memory: 512Mi
  requests:
    cpu: 500m
    memory: 128Mi
```

This means the every JVB pod will request minimum 500m CPU and 128Mi memory and it's maximum is 1000m (1 vCore) CPU and 512Mi memory. STUNner already has these resource limit set.

Now you have to create two *HorizontalPodAutoscaler* object. One for STUNner and one for JVB. These files location: [/configs/stunner/hpa.yaml](/configs/stunner/hpa.yaml) and [/configs/jitsi/hpa.yaml](/configs/jitsi/hpa.yaml).

Read them carefully and change it accordingly.

## Our experience with WebRTC load-testing

This is a large topic already on its own, but we try to give an overview about the approach we follow.
1. _Iperf_ : To measure the dataplane only we open a couple of TURN allocations and set the packet length and bitrate according to a selected codec. See [our benchmarking](https://github.com/l7mp/stunner/tree/main/examples/benchmark).
2. _Load test by self-built GO client_ : we built a [client-side GO library] (https://github.com/rg0now/kurento-tutorial-client-go) that mimics a single client for the Kurento based examples. The advantage of this solution is that you can scale up to as many instances as you wish, and also you can record each call to a file, but this approach requires cumbersome coding and deeper knowledge of the GO programming language.
3. _Livekit_load_test_ : If you happen to run a Livekit media server, the best way to test it is the [livekit-cli] (https://github.com/livekit/livekit-cli). As we see it in the Livekit community, most of the users are happy with its [load-testing capability] (https://docs.livekit.io/oss/benchmark/). We gave a try to a [previous version] (https://github.com/livekit/chrometester) (no longer supported), and it worked fine.
4. _WebRTC_perf_ : Have not tried [this project] (https://github.com/vpalmisano/webrtcperf), but it has been among the TODO items in the last couple of months.
5. _TestRTC_ : Seems to be the de-facto [commercial solution](https://testrtc.com/testingrtc/), but we found it too costly to set it up for testing our use-cases.
